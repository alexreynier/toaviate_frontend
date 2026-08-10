# Backend Guide — Time Rounding & Invoice PDF Legibility

**Audience:** backend team (invoice PDF generation, and any other server-rendered
output that prints clock times).
**Written:** August 2026, after the frontend rounding change described below.
**Goal:** members must never have to "figure out" why a charged time differs from
what they remember seeing. Every printed time should be either exact, or visibly
and explicably rounded.

---

## 1. The problem we just fixed on the frontend

Flight times are stored to the second (e.g. brakes off `11:32:55`), but the UI
only ever shows `HH:mm`. Until now the frontend **truncated** the seconds:

```
stored 11:32:55  →  displayed 11:32          (truncation — WRONG)
```

Members then compared that against the nearest-5-minutes value the backend
supplies (`brakes_off_rounded` = `11:35:00`) and concluded the rounding was
broken — "11:32 should round to 11:30, not 11:35!". The maths was actually
right; the *display* was lying by 55 seconds:

```
11:32:55 → nearest minute → 11:33 → nearest 5 minutes → 11:35   ✓
```

The frontend now **rounds to the nearest minute** everywhere a clock time is
displayed, and shows a tooltip explaining any rounding. The invoice **PDFs are
the remaining place** members see these times, so they need the same treatment
— on paper there are no tooltips, so the explanation has to be printed.

---

## 2. The exact rounding rule the frontend now uses

Please mirror this rule byte-for-byte so PDFs and app screens can never
disagree. Frontend reference implementation: `roundTimeToMinute()` in
[js/directives/datetime.js](js/directives/datetime.js).

Round a `HH:mm:ss` clock time to the nearest minute:

1. If seconds `>= 30`, add one minute; otherwise drop the seconds.
   (Exactly `:30` rounds **up**.)
2. Minute overflow carries into the hour: `11:59:45 → 12:00`.
3. Hour overflow wraps past midnight: `23:59:31 → 00:00`
   (note the date shown alongside should remain the flight date — do not roll
   the date forward on a display-only rounding).
4. Values already in whole minutes (`:00` seconds) are unchanged.
5. The sentinel `00:00:00` means "no time recorded" — print a dash, never
   `00:00`.

The **nearest-5-minutes** values (`brakes_off_rounded` / `brakes_on_rounded`)
remain backend-owned and unchanged — the frontend displays them verbatim. The
important property is that they are (and must stay) derived from the *true*
seconds-precision time, not from a truncated one.

---

## 3. What the app now shows (for parity)

Everywhere a time appears (journey logs, student records, club flights list,
invoices in-app, member flight history):

- **Displayed value:** rounded to the nearest minute (or the backend `_rounded`
  field where the nearest-5 value is the one being shown).
- **Tooltip on hover:** e.g.
  - `Takeoff — actual time 11:32:55, rounded to 11:33 (nearest minute)`
  - `Brakes off — actual time 11:32:55, rounded to 11:35 (nearest 5 minutes)`
- If rounding didn't change the value, the tooltip makes no rounding claim.

---

## 4. What the invoice PDFs should do

The in-app invoice views show, per flight (fields from `flight_details`):

| Field | Meaning |
|---|---|
| `tpc_brakes_off` / `tpc_brakes_on` | the **charged** window (e.g. airborne time + 10 min taxi allowance, per club charging model) |
| `brakes_off_rounded` / `brakes_on_rounded` | the **logbook** window, first-move → last-move, rounded to nearest 5 minutes |

Recommendations for the PDF:

1. **Never truncate seconds.** Any time printed as `HH:mm` must be rounded per
   §2. This is the minimum change and the direct equivalent of the frontend fix.

2. **Print the actual times once, in small print.** Since PDFs have no
   tooltips, add a per-flight footnote line, e.g.:

   > Recorded times: brakes off 11:32:55, takeoff 11:36:12, landing 12:41:03,
   > brakes on 12:44:41. Logbook times are rounded to the nearest 5 minutes;
   > all other times to the nearest minute.

3. **State the charging basis in words, not just numbers.** The in-app tooltip
   currently says *"There are two times because you are being charged airborne
   time in addition to 10mins, however your actual brakes off to brakes on may
   differ."* The PDF should carry the same explanation next to the charged
   window, ideally with the arithmetic spelled out:

   > Charged: airborne 11:36–12:41 (1:05) + 10 min taxi allowance = **1:15**

4. **Label the two windows distinctly** — "Charged time" vs "Logbook time" —
   exactly as the app does, so a member comparing PDF to screen sees identical
   numbers with identical labels.

5. **Round the money-bearing duration from the true seconds**, then present it;
   don't derive it from already-rounded displayed times, or the printed
   arithmetic won't add up to the printed line total.

---

## 5. Acceptance check

For a flight with brakes off `11:32:55`:

- PDF must **not** show `11:32` anywhere.
- Nearest-minute presentation: `11:33`.
- Nearest-5 presentation: `11:35`, and the footnote shows `11:32:55` so the
  member can see *why*.
- A member holding the PDF next to the app's invoice screen sees the same
  numbers with the same labels.

---

## 6. Open questions — charge type (frontend → backend)

The frontend has implemented the §7 parity spec (see reply), but the in-app
views decide whether to show the "Charged: airborne … + taxi allowance" line
purely from **`tpc_brakes_off` being present** in `flight_details`. Aircraft
have a per-plane `charge_type` (`brakes` / `tacho` / `hobbs` / `airborne` /
`flight` / `brakes_rounded`) that the invoice payloads don't expose, so please
confirm:

1. **Is `tpc_brakes_off` only ever populated when the flight was genuinely
   charged on the airborne + taxi basis?** If it can be present for tacho- or
   hobbs-charged flights, the printed explanation would misstate how the
   charge was computed — on PDFs and in-app alike.
2. **Please add the charging basis explicitly to `flight_details`**, e.g.
   `charge_basis: "airborne_plus_taxi" | "brakes" | "tacho" | "hobbs" | ...`,
   so both PDF and frontend branch on fact rather than field-presence
   inference. (The flight-edit financial preview already returns
   `breakdown.charge_type`, so this exists server-side.)
3. **For tacho/hobbs-charged flights, what should the charged line read?**
   Suggest `Charged: tacho 1234.5 → 1235.7 = 1.2 hours` — which requires the
   meter readings in `flight_details` (the PDF footnote needs them for the
   same reason).
4. **Confirm `takeoff_rounded` / `landing_rounded` are being added** to the
   invoice `flight_details` payloads. Until they arrive, the frontend (by
   design) falls back to the plain `Charged time: HH:mm - HH:mm` window with
   no arithmetic.
