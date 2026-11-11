# ToAviate design guidelines

**Status:** draft for review, 2026-11-06. Once approved, these replace the "snazzy" rules for every new or
redesigned page, and CLAUDE.md's Design System section will point here.
**The stylesheets:** `css/ta-base.css` (tokens + every primitive, light) and `css/ta-night.css` (the night-mode token swap) —
one set for every new page, registered in `index.html` and the Gruntfile right after `snazzy-pages.css`.
**See it rendered:** `../mockups/design-system.html` (every token and component, drawn by those two files, desktop and phone, light and night).

These guidelines come from three pieces of work that already share one language: Scheduler v2
(`css/scheduler-v2.css`, `css/booking-form.css`, `libs/css/toaviate-scheduler.css`), the book-out redesign
(`mockups/bookout-redesign.html`, being built in `css/bookout.css`) and the invoices & payments mockup
(`mockups/invoices-payments-redesign.html`). Where those three disagree, this document picks one answer.

---

## 1. Principles

1. **Calm surfaces, colour that means something.** Pages are white cards on a soft grey ground. The brand
   gradient marks only what identifies the page: its icon, the selected tab, the primary button, a hero. Every
   other colour carries meaning: a booking type, an aircraft, a status. If a colour means nothing, take it out.
2. **State has a shape and a word.** Never colour alone. A status is a pill with an icon and a plain word.
   A dashed outline means "not final yet" (an unconfirmed booking, a direct debit still being requested). A
   coloured left edge means identity (the aircraft) or attention (something owed).
3. **The object is the headline.** A page about one thing (an aircraft being booked out, an invoice being paid)
   leads with that thing in large type. A page about many things leads with a page bar and a summary.
4. **One primary action per view.** It sits at the end of the flow or in a fixed action bar. Everything else is
   quieter.
5. **Phones are designed, not squeezed.** Every view is laid out at 390px as well as desktop width.
6. **Explain in place.** Tooltips are a bonus. Phones have no hover, so the essential explanation is a visible line
   of text under the figure or control.

---

## 2. Foundations

### 2.1 Tokens

One set of custom properties, `--ta-*`, defined once in `css/ta-base.css` on `:root` and swapped in one
block under `body.night-mode` in `css/ta-night.css`. Page CSS uses the tokens and never raw hex, except for the fixed colours in 2.2.
The per-page sets that exist today (`--tas-*` in the scheduler library, `--bo-*` in the book-out) hold the same
values and become aliases of these.

**Brand**

| Token | Light | Night | Use |
|---|---|---|---|
| `--ta-brand` | `#1e3a5f` | `#1e3a5f` | Selected filter chip, headings on tints |
| `--ta-brand-2` | `#2d5a8e` | `#2d5a8e` | Focus border, radio and switch "on", dashed outlines |
| `--ta-grad` | `linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)` | same | Page icon, selected tab, primary button, hero |
| `--ta-accent` | `#2d5a8e` | `#93c5fd` | Links and icons on plain surfaces |
| `--ta-tint` | `#ebf4fc` | `#172a46` | Info surfaces, dashed "pending" fill |
| `--ta-tint-2` | `#f0f6fd` | `#1b2a40` | Record dialog header, an open row |
| `--ta-group` | `#ddecfa` | `#22344d` | Group header rows, icon wells |
| `--ta-brand-line` | `#bfdbfe` | `#2d5a8e` | Borders of tinted surfaces |

**Text, surfaces and lines**

| Token | Light | Night | Use |
|---|---|---|---|
| `--ta-ink` | `#1e293b` | `#f1f5f9` | Body text, titles, figures |
| `--ta-ink-2` | `#334155` | `#e2e8f0` | Secondary body text |
| `--ta-muted` | `#64748b` | `#94a3b8` | Sub-lines, explanations, inactive tabs |
| `--ta-faint` | `#94a3b8` | `#64748b` | Labels, placeholders, column headings |
| `--ta-paper` | `#ffffff` | `#1e293b` | Cards, bars, dialogs, inputs |
| `--ta-paper-2` | `#f8fafc` | `#172033` | Inset tiles and panels, column label rows |
| `--ta-paper-3` | `#f1f5f9` | `#273449` | Pill tracks, muted pills, hover |
| `--ta-line` | `#e2e8f0` | `#334155` | Card and control borders, dividers |
| `--ta-line-2` | `#cbd5e1` | `#475569` | Hover borders, empty radio rings |

**Tones.** Each tone has a solid colour, a `-bg` for pills, an `-ink` for text on that background, a `-line` for
borders and a `-wash` for large surfaces such as tiles.

| Tone | Solid | `-bg` | `-ink` | `-line` | `-wash` | Night `-bg` / `-ink` / `-line` / `-wash` |
|---|---|---|---|---|---|---|
| good | `#16a34a` | `#dcfce7` | `#166534` | `#86efac` | `#f0fdf4` | `#14532d` / `#bbf7d0` / `#166534` / `#132a1d` |
| warn | `#d97706` | `#fef3c7` | `#92400e` | `#fcd34d` | `#fffbeb` | `#3b2a0a` / `#fde68a` / `#92400e` / `#2a2113` |
| bad | `#dc2626` | `#fee2e2` | `#991b1b` | `#fca5a5` | `#fef2f2` | `#450a0a` / `#fecaca` / `#7f1d1d` / `#2a1517` |
| info | — | `#dbeafe` | `#1e40af` | `#bfdbfe` | — | `#1e3a8a` / `#bfdbfe` / `#2d5a8e` / — |

**Elevation, focus, radius**

| Token | Light | Night | Use |
|---|---|---|---|
| `--ta-shadow-1` | `0 1px 3px rgba(30,58,95,.06)` | `0 1px 3px rgba(0,0,0,.3)` | Cards, bars |
| `--ta-shadow-2` | `0 10px 30px rgba(30,58,95,.14)` | `0 10px 30px rgba(0,0,0,.5)` | Hover lift, floating menus |
| `--ta-shadow-3` | `0 24px 60px rgba(15,23,42,.28)` | `0 24px 60px rgba(0,0,0,.6)` | Dialogs, sheets |
| `--ta-focus` | `0 0 0 3px rgba(59,130,246,.12)` | `0 0 0 3px rgba(147,197,253,.28)` | Input focus ring, with a `--ta-brand-2` border |
| `--ta-r-sm` | `6px` | | Aircraft chip, tags |
| `--ta-r-control` | `8px` | | Inputs, buttons, icon buttons |
| `--ta-r-tile` | `12px` | | Tiles, inset panels, choice segments, toggle rows |
| `--ta-r-card` | `14px` | | Cards, page bars, list cards |
| `--ta-r-dialog` | `16px` | | Dialogs (a phone sheet is `22px` on its top corners) |
| `--ta-r-pill` | `999px` | | Pills, chips, tab tracks |

### 2.2 Fixed colours (the same in both themes)

These identify things, so they never change with the theme.

| What | Colour | Icon (Font Awesome 5) | Notes |
|---|---|---|---|
| Dual lesson | `#2d5a8e` | `fa-user-friends` | Dual chips stay white; others get a 10% wash |
| Solo | `#7c3aed` | `fa-user` | Wash `#f2ebfd` (night `#332d62`) |
| Self-fly hire | `#0d9488` | `fa-key` | Wash `#e7f4f3` (night `#1a414c`) |
| Trial lesson | `#d97706` | `fa-star` | Wash `#fbf1e6` (night `#473a2f`) |
| Maintenance | `#94a3b8` | `fa-wrench` | Hatched grey |
| Membership | `#475569` | `fa-id-card` | Invoices |
| Fee | `#b45309` | `fa-receipt` | No-show, late cancellation |
| Exam | `#0369a1` | `fa-graduation-cap` | |
| Credit | `#16a34a` | `fa-hand-holding-usd` | Negative amounts |
| Subscription | `#64748b` | `fa-satellite-dish` | Tracker plans |
| An aircraft | its record's colour | — | Only ever a 4px left edge |
| An instructor | their member colour | — | Only ever the initials circle |

### 2.3 Typography

- **Font:** the system stack `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
  Monospace `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` for ICAO codes and references.
  (The scheduler libraries declare Manrope, but nothing loads it, so it never renders. See open decisions.)
- **Numbers** that line up or change (money, times, counts, hours) use `font-variant-numeric: tabular-nums`.

| Role | Size / weight | Notes |
|---|---|---|
| Headline figure | 32–34px / 800, −0.02em | The registration in a hero, the amount in a pay dialog |
| Page title | 19–20px / 800, −0.01em | Page bar |
| Card / section title | 15–16.5px / 800 | Card header, dialog section |
| Tile figure | 21px / 800 | Summary tiles; compact boxes use 16px |
| Body | 14px / 400–600, line-height 1.45 | |
| Secondary | 12.5–13px | Sub-lines, explanations, in `--ta-muted` |
| Label | 10.5–11px / 800, uppercase, letter-spacing .07–.08em | Field labels, column headings, tile keys |
| Pill | 11–11.5px / 700 | |

Nothing is smaller than 10.5px. Inputs are 14px on desktop and 16px on phones; the global guard at the end of
`snazzy-pages.css` already forces this, because iOS zooms into smaller inputs and the app never zooms back out.

### 2.4 Icons

Font Awesome **5** only: free solid (`fas`), regular (`far`) and brands (`fab`). Font Awesome 6 names render nothing.

| Icon square | Size / radius | Fill |
|---|---|---|
| Page | 40px / 10px | `--ta-grad`, white glyph 17px |
| Card header | 34–36px / 10px | `--ta-grad`; a green gradient once that step is done |
| Row / booking type | 32–34px / 9px | The type colour from 2.2 |
| Inline / method | 28–30px / 8px | `--ta-paper-3` with an `--ta-accent` glyph; gradient when selected |
| Empty state well | 56px / 16px | `--ta-group` |

### 2.5 Spacing

A 4px base: **4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 32**. Use `gap` on flex and grid, not margins between siblings.

| Where | Phone | Desktop |
|---|---|---|
| Between cards and sections | 12 | 14 |
| Card padding | 16 | 20 |
| Page bar padding | 14 | 14 × 18 |
| List row padding | 12 × 14 | 11 × 16 |
| Label to control | 6 | 6 |
| Inline items (chips, pills, icons) | 6–8 | 6–8 |

---

## 3. Layout

- **Page shell (`.ta-page`).** Every redesigned page sits in one wrapper with explicit widths: 100% up to 768px,
  then 800 (≥769), 950 (≥1000), 1150 (≥1200) and 1320 (≥1400), centred, with left-aligned text. Explicit widths are
  needed because the host `.centre_align_boxes2` is a centred flex row that shrink-wraps pages to their content (the
  book-out pattern). The shell also neutralises the legacy resets listed in section 9.
- **Order:** header → summary (if the page has one) → main content (list or cards) → the action.
- **Two columns:** main content plus a sticky rail (320px) from 992px. On a phone the rail's content becomes a strip
  at the top and a fixed bottom bar. That is the same markup moved by CSS, so each element exists once.
- **Breakpoints:** ≤768 phone (primary); 769–991 tablet (one column, desktop controls); ≥992 rail layouts; ≥1200
  wide. A component that also lives in a narrow container (the 460px booking panel, a dialog) may use container
  queries instead.
- **Phones:**
  - side gutter 12–16px
  - touch targets at least 44px
  - the primary action full width in a fixed bottom bar, with safe-area padding
  - chip rows scroll sideways instead of wrapping
  - dialogs become bottom sheets
  - tables become row cards

---

## 4. Components

Each component lists its purpose, its anatomy and where it already exists. Class names are the proposed shared
primitives (`.ta-*`); page-specific layout keeps a page prefix (`bo-`, `bil-`, `sv2-`).

### 4.1 Page header: page bar or hero (never both)

- **Page bar (`.ta-bar`), the default** for lists, hubs and tools (source: `.sv2-bar`).
  - The card: white, `--ta-r-card`, `--ta-shadow-1`.
  - Row 1: the 40px gradient icon square, the title and a one-line hint. Back sits on the right ("← My Account"); on
    a phone it becomes a 36px icon button.
  - Row 2, below a `--ta-paper-3` divider: tabs, scope chips and search, with search on the right on desktop and full
    width on a phone.
- **Hero (`.ta-hero`)** for a page about one object you are acting on: the book-out, the booked-out screen and,
  later, an aircraft or member page.
  - A brand-gradient band with white text and an eyebrow label.
  - The object in headline type (registration 34px / 800), with fact tiles in translucent white.
  - Rounded bottom corners: 22px on phones, 16px on desktop.

### 4.2 Switching and filtering: four controls, four jobs

| Control | Job | Look | Source |
|---|---|---|---|
| **Tabs** `.ta-tabs` | Switch between views or pages of a hub | A `--ta-paper-3` pill track; the selected tab gets the gradient, white text and a count badge. Aim for at most four. On phones 3–4 tabs wrap two-up; 5+ scroll in one row (scroll the selected tab into view). | `.wrp__seg--views`, billing mockup |
| **Scope** `.ta-scope` | Choose which club or set you are looking at | A `--ta-paper-3` track; the selected option is white and raised. Only shown when there is more than one option; remembered per browser. | `.sv2-clubs` |
| **Filter chips** `.ta-chip` | Narrow a list | Separate outline chips, each with a count. The selected chip is solid `--ta-brand` (night `#3b82f6`). Hide zero counts except "All"; a "Needs attention" chip uses the warn wash. | billing mockup |
| **Choice segment** `.ta-seg` | Pick a value inside a form | Tiles in a bordered `--ta-paper-2` track, `--ta-r-tile`; the selected tile is white with a brand icon. Two to four options. | `.bo-seg`, `.bkf-seg` |

### 4.3 Cards

- **The card:** white, a 1px `--ta-line` border, `--ta-r-card`, `--ta-shadow-1`, padding 16 on phones and 20 on desktop.
- **Header:** a 34–36px gradient icon square, the title (15–16.5px / 800), a sub-line (12.5px muted) and an optional
  right-hand slot for a chip.
- **Steps:** in a flow, cards can be numbered, with a step badge on the icon. The icon turns to the green gradient
  when that card has nothing left to do (source: `.bo-card`).
- **Nesting:** one level only. Inside a card, use **inset panels** (`--ta-paper-2`, `--ta-r-tile`, no shadow).

### 4.4 Tiles and overview boxes

- **Tile (`.ta-tile`):** an inset figure that matters. It has an uppercase label, the figure (21px / 800) and one
  visible line explaining it. Tones:
  - **attention:** warn wash and warn line, for something the user must do
  - **progress:** `--ta-tint-2`
  - **bad:** bad wash
  - **quiet:** for "not set up"
- **Tile grid:** `repeat(auto-fit, minmax(170px, 1fr))` on desktop; two columns on a phone. Words such as
  "Nothing to pay" use a 17px value that may wrap.
- **Overview box (`.ta-overview`):** for many of a kind, such as one box per club. It is compact and clickable. Its
  4px left edge shows the state (warn when something is owed, bad when something failed). It holds three compact
  figures and "Full summary →". Choosing one opens that item's full card.

### 4.5 Lists

- **List card:** white, `--ta-r-card`. It holds:
  - a toolbar with the filter chips
  - a column label row, desktop only (label type on `--ta-paper-2`)
  - **group headers** (month or section label on the left, subtotal on the right), with "Needs your attention" pinned
    first in the warn wash
  - the rows
- **Row on desktop:** `[type square] [title + sub-line] [domain chips] [date] [status] [amount →] [actions →]` as one
  grid. Cells keep their natural width (`justify-self: start`); amounts and actions align right.
- **Row on a phone:** two lines.
  - Line 1: `[square] [title, clamped to 2 lines, + sub-line] [amount] [chevron]`
  - Line 2: `[chips · date · status]`
  - Actions move inside the opened row.
- **Opening a row:** the row is a `<button aria-expanded>` and opens in place on `--ta-tint-2`, with inset panels;
  the chevron rotates. One toggle, no separate "eye" icon.
- **Rows or a table:** prefer rows for anything people scan. Use a real table only for dense numbers compared
  column by column, such as the logbook. Give it a label-style header row, not the old gradient thead, and an
  `overflow-x: auto` container, with phone cards below 768px.

### 4.6 Status pills

One vocabulary. Each domain maps its backend statuses through **one helper** (as `SchedulerV2Service.statusLabel` and
`WaitingRequestsService.dateLabel` already do). Raw enums never reach the screen.

| Tone | Meaning | Examples |
|---|---|---|
| `good` | Done | Paid, Confirmed, Ready to fly, Booked |
| `warn` | Needs the user | To pay, Awaiting confirmation, Contacted |
| `bad` | Failed or refused | Failed, Charged back, Declined, Expired |
| `info` | In progress, nothing to do | Requested, Flying now |
| `pend` | Not final yet: a **dashed** `--ta-brand-2` outline on `--ta-tint` | Requesting, Unconfirmed booking, Invited |
| `muted` | No longer relevant | Voided, No charge, Not required |

Every pill has an icon and a word: 11.5px / 700, padding 3 × 9, `--ta-r-pill`.

### 4.7 Domain marks

- **Booking type square:** the type colour with a white glyph, 32–34px. The same square starts invoice rows, so a
  dual lesson looks the same on the scheduler and on its invoice.
- **Aircraft chip:** the registration in 800 weight, the type in `--ta-faint`, a 4px left edge in the aircraft's
  colour and `--ta-r-sm` corners.
- **People:** a coloured initials circle means **instructor**, everywhere. Members get a neutral grey person icon.
- **Places:** ICAO code in monospace and upper case, then the name in muted text: `EGLD Denham → EGTK Oxford`.
- **Money:** symbol plus tabular figures, `£1,234.50`. Credits use a true minus and the good colour: `−£200.00`.
- **Times:** 24-hour, in club wall-clock time, never shifted by the device's timezone (`06:00`).
- **Dates:** `4 Nov 2026` in lists; `Wed 4 Nov` or `Wed 4 Nov 2026` where the weekday matters.
- **Durations:** flight and charged time as h:mm (`1:12`); a booking's length as `1h30`.

### 4.8 Forms

- **Field:** the label (11px / 800, uppercase, optional icon) above the control, with a 6px gap. Lay fields out in a
  two-column grid on desktop and one column on a phone.
- **Text controls:** 42px high (44px+ on a phone), `--ta-r-control`, a 1px `--ta-line` border; on focus a
  `--ta-brand-2` border plus `--ta-focus`.
- **Prefilled values:** `--ta-tint` with `--ta-brand-line`.
- **Errors:** the label and border turn bad, the field shakes once and a 12px / 600 message appears below. The fields
  keep the `id="field-*"` hooks used by `ToastService.validateForm`.
- **Pickers:**
  - **Dates:** always `<ta-date-picker>`, never the browser's native picker.
  - **Searchable lists:** ui-select with the `.bkf-us` skin. Include `<ui-select-no-choice>` and never
    `minimum-input-length` (this version stops rendering rows with it).
- **Toggle row (`.ta-toggle`):** a bordered row with the title and sub-line on the left and a switch on the right.
  Variants: `warn` (an acknowledgement, which turns good once on), `confirm` and `solo` (source: `.bo-toggle`).
- **Checkboxes:** 16px, `accent-color: var(--ta-brand-2)`.

### 4.9 Buttons

| Kind | Look | Use |
|---|---|---|
| Primary | `--ta-grad`, white, 700, `--ta-r-control`, padding 9 × 14 | One per view |
| Secondary | White, `--ta-line` border | Everything else that matters |
| Quiet | No border, muted text, tint on hover | Close, Back, minor actions |
| Danger | Quiet until hovered inside cards; solid red in a confirmation step | Cancel booking, Reverse |
| Small | Padding 6 × 11, 12.5px | In rows |
| Icon | A 32px square, `--ta-r-control`, bordered, always with a tooltip | Download, open row |
| Link | `--ta-accent`, 700, with an arrow | "Full summary →" |

- **Labels** are a verb and an object in sentence case: "Pay £50.00", "Keep booking", "Mark as no-show". Put the amount
  or object in the label when it helps.
- **Busy state:** the busy guard handles most buttons. Flows it doesn't cover (Stripe, card machine) show a spinner
  inside the button and "Processing…".

### 4.10 Notes and banners

Inline, `--ta-r-tile` (10–12px), padding 10 × 12, an icon and text. Tones:
- **info:** `--ta-tint` with brand text
- **warn**
- **bad:** with a line
- **good**
- **quiet:** `--ta-paper-3`

Use one note per context. It says what is happening and what to do. A banner that leads somewhere uses a link
button inside it, never a toast.

### 4.11 Dialogs, sheets and panels

There are two kinds of dialog. The kind is decided by the content, not by taste.

- **Record dialog:** about a thing, such as the booking card or paying an invoice.
  - Header: `--ta-tint-2` with an **8px left edge in the thing's colour** (the aircraft colour, or the status tone).
  - The eyebrow and the object or amount large, plus a round white × button.
  - Then the body, then the footer: Cancel on the left, the primary action on the right.
- **Alert dialog:** a warning or a decision, such as defects, overrides or a conflict.
  - A **gradient header in the tone** (brand, warn `#b45309 → #f59e0b`, bad `#991b1b → #dc2626`).
  - A white icon well, the title and a one-line reason.
- **Both kinds:**
  - `--ta-r-dialog` corners and `--ta-shadow-3`
  - 520px wide (900px for wide panels such as the waiting list)
  - a `rgba(15,23,42,.55)` scrim, with no blur
  - Esc or a click on the scrim closes it unless something is saving
- **On phones (≤600px)** the dialog is a **bottom sheet**: full width, `22px` top corners, a grab handle, the edge
  moved to a top border, and full-width buttons above the safe area.
- **Destructive confirmations** happen in place: a two-step button ("Reverse" becomes "Void the invoice?") or a step
  inside the dialog. Never `confirm()`, `alert()` or `prompt()`.
- **Slide-out panel:** for creating or editing over a page that must stay visible (the v2 booking panel). It is 460px
  on the left, a full sheet at ≤768px, and has a sticky action bar.

### 4.12 Action bar

Fixed to the bottom on phones: translucent `--ta-paper`, a top border and safe-area padding. Inside panels it is
sticky. It holds the one primary action and, optionally, a progress hint ("2 checks left"). It sits above
ui-select's z-index of 9999 (the booking panel uses 10010).

### 4.13 Feedback

- **Toasts:** `ToastService` only (success, warning, error), with a title and one line and no buttons. Each
  handler's own toast wins over the write guard's generic "Not saved".
- **Loading:**
  - skeleton blocks with a shimmer for anything that takes more than 300ms
  - a spinner inside the pressed button
  - the full-page plane overlay is legacy; don't use it for a single action
- **Empty states:** the 56px icon well, a title and one sentence on what will appear here and how, plus an optional
  action.
- **Errors:** what went wrong and what to do, in plain words; no codes, no apologies.

### 4.14 Progress

- **Steps tracker (`.ta-steps`):** dots joined by lines, for states that move through stages. A done step is a green
  dot, the current step a brand ring, a failed step red. For example, a direct debit goes Requesting → Requested → Paid.
- **Meter:** a 6px bar for a quantity with a limit, such as hours to the next maintenance. A meter for something
  that runs out (hours or days left) **empties like a fuel gauge** as it runs out; it turns amber when close and red
  when over.

### 4.15 Shared components promoted from the mockups (2026-11-07)

Each of these was invented more than once under a page prefix while the My Account mockups were made. They now live
once in `ta-base.css`; use them before writing page CSS. Variants that differ on purpose are modifiers.

- **The runway (`<ta-runway>`, `.ta-runway*`, js/v2/core/runway.js — 2026-11-10):** the "we're working on it" piece
  born on the sign-in page: the strip with its markings, the aircraft taking off, optional `steps` + `step` (ticked in
  turn, with a progress bar) and a `text` line; `compact` for a sheet or dialog. Use it for a wait where the app is
  DOING something for the person (signing in, saving, paying, searching) — skeletons remain the right thing for a list
  that is loading. The **default slow-wait indicator** needs nothing from a page: when an API call has been pending
  over 1.2 s on a v2 page, a small runway floats at the bottom ("Still working…", `.ta-runway-float` in
  views/dashboard.html) until every call has answered, and stays quiet while the page shows a runway of its own.
- **Readiness (`.ta-ready`, `.ta-ring`, `.ta-cks` / `.ta-ck`, `.ta-ready__foot`):** "Before you finish / save" — a rail
  on desktop (ring, checklist, Next button), a scrolling strip plus a fixed bottom bar on phones, all from one markup.
  Checklist states: `--done`, `--part` (met, not complete), `--bad` (after a failed attempt), `--opt` (optional).
- **Two-line call to action (`.ta-cta`, `__main`, `__sub`, `--wait`)** and the **final card** it closes
  (`.ta-final`, `--ready`, `__go`), with the **missing list** above the button (`.ta-left`, `--bad`) and a **summary**
  of what will be saved (`.ta-sum`, `__row` / `__k` / `__v`).
- **Picker A (`.ta-pick` + `.ta-pickmenu`):** a field-like button that opens a list with its own search; a dropdown on
  desktop, a bottom sheet on phones. For choosing one thing from a known list (a course, a lesson, a person).
- **Picker B (`.ta-combo`):** a search field you type into, with matches under it; full screen with Cancel on phones.
  For finding one thing in a big set (a flight among hundreds, an aircraft). Keyboard highlight is `__opt--hi`.
- **Stepper (`.ta-stepper`, `__b`, `__n`; `--joined`):** − n +, for small whole numbers (landings, minutes in 5s).
- **Confirm in place (`.ta-confirm`, `__btns`; `--inline`):** the replacement for `confirm()` on a destructive action.
- **Drop zone (`.ta-drop`, `__ic`, `__t`, `__s`; `--row`, `--lg`, `--sm`, `--over`, `--busy`, `--done`).**
- **Small helpers:** `.ta-desk-only` / `.ta-phone-only`, `.ta-nowrap`, the neutral icon square `.ta-ic` (`--sm`, `--lg`,
  `--brand`, `--group`, tones), the section heading between cards `.ta-sh`, the Required tag `.ta-req`, the search
  match `.ta-mark`.

---

## 5. Night mode

- **Switching:** `NightModeService` puts `body.night-mode` on the page.
- **Tokens:** they swap in one block, so component CSS that uses tokens needs no night rules of its own.
- **Exceptions:** the fixed colours in 2.2 stay as they are, gradients keep the brand colours, and the page root sets
  `color-scheme: dark` so native controls and scrollbars follow.
- **Before done:** check every page in night mode.

## 6. Motion

- **Timing:** 150–200ms with ease. Dialogs pop in over 200ms, sheets slide up and opened rows fade down 4px.
- **Fill mode:** always `animation-fill-mode: backwards`, never `forwards` on transforms. A transform that persists
  traps `position: fixed` children such as popups.
- **Restraint:** respect `prefers-reduced-motion`, and loop nothing except spinners.

## 7. Words

- **Voice:** write from the user's side: "To pay", not "Created"; "Requested from your bank", not "submitted".
  Sentence case everywhere.
- **Statuses:** map them in one helper per domain. Examples:

| Domain | Backend value | On screen |
|---|---|---|
| Invoice | `issued` / `created` | To pay |
| Invoice / payment | `pending_submission` | Requesting |
| Invoice / payment | `submitted` | Requested |
| Invoice / payment | `paid`, `paid_out`, `confirmed` | Paid |
| Invoice | `direct_debit` | In next direct debit |
| Waiting list day | `declined` | Couldn't take it |
| Passenger | `accepted` / `invited` | Ready to fly / Invited — awaiting reply |

- **Figures** carry their explanation as a visible sub-line (today's tooltip text becomes that line).
- **Empty states** say what will appear and how. **Errors** say what happened and how to fix it.
- **Avoid** exclamation marks, "Please" at the start of every line, and jargon such as GoCardless state names.

## 8. Accessibility

- **Contrast:** use the ink tokens on paper for anything people must read. Muted and faint are only for secondary
  text of at least 12px, and for labels.
- **Focus:**
  - inputs use the focus ring
  - other controls use `outline: 2px solid #93c5fd; outline-offset: 2px` on `:focus-visible`
- **Keyboard and semantics:**
  - rows that open are buttons with `aria-expanded`
  - tabs use `role="tablist"`
  - dialogs have `aria-modal`, move focus inside and close on Esc
  - toggles are real checkboxes, visually hidden, with the switch drawn next to them
- **Touch:** targets of at least 44px on phones (buttons and icon buttons are 44px, chips and scope options 40px in ta-base), and inputs of at least 16px.
- **Colour:** never the only signal; always an icon and a word as well.
- **Icons:** decorative icons are hidden from screen readers; icon-only buttons have a label.

## 9. Building it in this codebase

- **The shared stylesheets:** `css/ta-base.css` holds the tokens plus the shared primitives (`.ta-page`, `.ta-bar`,
  `.ta-hero`, `.ta-tabs`, `.ta-scope`, `.ta-chip`, `.ta-search`, `.ta-card`, `.ta-panel`, `.ta-tile`, `.ta-ovbox`,
  `.ta-list` / `.ta-row` / `.ta-detail`, `.ta-pill`, `.ta-kind`, `.ta-ac`, `.ta-av`, `.ta-icao`, `.ta-money`, `.ta-facts`,
  `.ta-field`, `.ta-input`, `.ta-seg`, `.ta-toggle`, `.ta-check`, `.ta-btn`, `.ta-ib`, `.ta-link`, `.ta-note`,
  `.ta-steps`, `.ta-meter`, `.ta-table`, `.ta-empty`, `.ta-skel`, `.ta-dlg-scrim` / `.ta-dlg` / `.ta-opt`,
  `.ta-actionbar`, and the shared components of 4.15); `css/ta-night.css` holds only the night-mode token swap. Both are registered right after
  `snazzy-pages.css` in `index.html` and the Gruntfile. Page CSS stays in `css/<feature>.css` with its page prefix,
  loads after them and uses the tokens. Desktop list rows take their columns from `--ta-row-cols` on the `.ta-list`.
  The legacy resets inside `.ta-page` are written as `.ta-page :where(…)` (specificity 0,1,0) so they beat
  `styles.css` element rules but never a component class.
- **Naming and structure** (every mockup follows this, so implementation is a copy, not a translation):
  - `ta-` classes exist only in `ta-base.css`. A page never defines a `ta-` class; it uses one, or adds a modifier there.
  - Everything page-specific has **one** short page prefix (`bil-`, `bki-`, `dbf-`, `lgb-`…) and BEM:
    `block__element--modifier`. Page CSS lives in `css/<feature>.css` and holds layout, not new components.
  - State words are shared: `--on` (selected), `--open`, `--done`, `--hi` (keyboard highlight), `--empty`, tones
    `--good` / `--warn` / `--bad` / `--info` / `--pend`. Element ids carry page state and keep the page prefix.
  - Colours come from tokens. Data colours arrive as custom properties on the element (`--ac` aircraft, `--av`
    instructor, `--k` kind, `--g` club grade); `style=""` is used for nothing else.
  - Night mode is the token swap in `ta-night.css`. Page CSS has no `body.night-mode` rules; if a page needs one, the
    token is missing — add it to both stylesheets instead.
  - `kit-` classes are mockup scaffolding (explainer notes, toast demos, demo controls): never copy them into the app.
- **Legacy traps:** neutralise these inside `.ta-page`; they have all bitten a recent page.
  - `styles.css` gives `h3` 36px and margins to `h1`–`h4` and `p`, pads every `<section>` 50px at the bottom, and
    resets `b` / `strong` to inherit their weight.
  - The global `.fa.fa-plane` colour rule darkens plane icons. Override it with at least 0,2,1 specificity.
  - `.centre_align_boxes2` centres text and shrink-wraps pages; the shell's explicit widths fix that.
  - `.snazzy-page__table-card` is hidden at ≤768px.
  - `select.css` gives every ui-select container z-index 9999.
  - On phones the body is the scroller, so sticky and fixed elements must allow for that.
- **Angular 1.4.7:**
  - no one-way (`<`) bindings
  - `ng-if` on an `ng-repeat` element silently does nothing
  - `ng-if` on the same element as `ng-controller` evaluates on the parent scope
  - the busy guard covers `ng-click` writes; drag callbacks and Stripe flows need their own flag
- **Migration:** one page or hub at a time.
  1. A mockup in `mockups/`, built with `mockups/_kit/kit.js` on the real `ta-base.css` / `ta-night.css`.
  2. Owner review.
  3. Implementation that keeps every `ng-model`, `id` and `data-e2e` hook.
  4. Verification on desktop, phone and night mode.

  The existing `--tas-*` and `--bo-*` sets become aliases of `--ta-*` in a later clean-up stage.
- **Snazzy pages** keep working as they are. Never mix snazzy chrome (gradient banner, gradient thead) and the new
  chrome on one page.

## 10. Done means

- [ ] Uses `--ta-*` tokens; no raw hex except the fixed colours.
- [ ] Uses the shared components (4.15) before page CSS; page CSS has one prefix and no `body.night-mode` rules.
- [ ] Page bar or hero, never both; one primary action.
- [ ] Every status goes through the domain helper and shows a pill with an icon and a word.
- [ ] Works at 390px: 44px targets, 16px inputs, bottom sheet, fixed action bar where needed, no sideways scroll.
- [ ] Works in night mode.
- [ ] Keyboard: visible focus, Esc closes dialogs, rows open with Enter or Space.
- [ ] Empty, loading and error states are designed, not left blank.
- [ ] New CSS registered in index.html **and** the Gruntfile.
- [ ] Verified on desktop and phone (Playwright screenshots of both widths).

## 11. Open decisions

1. **Web font.** Manrope is declared as the display face in the scheduler libraries but never loaded, so everything
   renders in the system font. Either load it (Google Fonts, weights 600–800) for titles and figures, or remove it
   from the libraries. **Recommendation:** stay on the system font. It is fast and it is what users already see.
2. **Page ground.** The new cards read best on a soft grey (`#f1f5f9`–`#eef2f7`); most pages sit on white today.
   Either the page shell paints a grey band, or the body background changes app-wide in one go.
3. **Snazzy retirement.** These guidelines take over for new and redesigned pages once approved. Untouched snazzy
   pages are rebuilt as each one comes up for redesign; there is no big-bang change.
