# Error Handling & Notifications — Agent Guide

> Reference for any AI agent working on this AngularJS frontend codebase.

---

## ToastService (replaces `alert()`)

A reusable AngularJS factory at `js/services/toastService.js`. Inject it into any controller:

```javascript
// 1. Add to $inject array
MyController.$inject = ['ToastService', ...];
function MyController(ToastService, ...) {

    // 2. Use it
    ToastService.success('Title', 'Optional subtitle');
    ToastService.error('Title', 'Optional subtitle');
    ToastService.warning('Title', 'Optional subtitle');
}
```

### Methods

| Method | Icon | Duration | Use when |
|--------|------|----------|----------|
| `.success(title, sub, opts)` | Green check + confetti | 3s | Action completed (booking created, saved, invitation sent) |
| `.error(title, sub, opts)` | Red X + shake | 5s | Validation failure, API error, permission denied |
| `.warning(title, sub, opts)` | Amber triangle | 4s | Non-blocking caution (instructor on holiday, currency expiring) |

### Options

```javascript
ToastService.success('Saved', 'Changes applied.', {
    duration: 4000,      // ms before auto-dismiss (default varies by type)
    confetti: false      // success only — skip confetti animation
});
```

### Rules

- **NEVER use `alert()`** — always use `ToastService`.
- **NEVER use `confirm()` or `prompt()`** — build inline UI or a `$uibModal` instead.
- Keep title short (2-4 words). Put details in subtitle.
- Error toasts from API responses: `ToastService.error('Booking Error', data.message)`.

---

## CSS Classes

Toast styles live in `css/styles.css`:

| Prefix | Type |
|--------|------|
| `.payok-*` | Success (green) |
| `.payfail-*` | Error (red) |
| `.ta-warn-*` | Warning (amber) |

All share animations: `payok-fade-in`, `payok-fade-out`, `payok-pulse`, `payok-draw`.

---

## Form Field Validation

### Pattern: validate before submit

In `bookings2Controller.js`, `validateBookingFields()` runs before `make_booking()`. Follow this pattern for any form:

```javascript
function validateMyForm() {
    // 1. Clear previous errors
    var prev = document.querySelectorAll('.my_form_table tr.field-error');
    for (var i = 0; i < prev.length; i++) { prev[i].classList.remove('field-error'); }

    // 2. Define checks — order matters (first failing field gets focus)
    var checks = [
        { ok: vm.someField,    id: 'field-some-id',   label: 'Some Field' },
        { ok: vm.otherField,   id: 'field-other-id',  label: 'Other Field' }
    ];

    // 3. Conditional checks
    if (someCondition) {
        checks.push({ ok: vm.conditionalField, id: 'field-cond', label: 'Conditional' });
    }

    // 4. Find first failure
    for (var j = 0; j < checks.length; j++) {
        if (!checks[j].ok) {
            var row = document.getElementById(checks[j].id);
            if (row) {
                row.classList.add('field-error');
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            ToastService.error('Missing: ' + checks[j].label,
                'Please fill in the highlighted field before submitting.');
            return checks[j].label; // truthy = blocked
        }
    }
    return null; // all good
}
```

### HTML requirements

Each validatable `<tr>` needs an `id`:

```html
<tr id="field-member">
    <td class="label"><label>MEMBER</label></td>
    <td class="selector">
        <ui-select ...>...</ui-select>
    </td>
</tr>
```

### CSS (already in `styles.css`)

The `.field-error` class on a `<tr>` inside `.make_booking_table`:
- Adds a red border + box-shadow to the `ui-select` or `input-group` inside it
- Turns the label red and bold
- Plays a horizontal shake animation (`field-shake` keyframe)

To reuse for other tables, either use `.make_booking_table` or add equivalent selectors for the new table class.

---

## API Error Handling Pattern

All service methods use `.then(handleSuccess, handleError2)`. Errors are caught at the service layer and returned as resolved promises with error data. Controllers check `data.success`:

```javascript
BookingService.Create(vm.user.id, booking)
.then(function(data) {
    if (data.success === true) {
        ToastService.success('Done', 'Booking created.');
        // ... refresh UI
    } else {
        // data.message contains the server's error string
        // data.more may contain an array of specific issues
        // data.allow_override may be true for admin-overridable errors

        if (data.more && data.more.length > 0) {
            // Build detailed message from data.more items
            // Known names: differences_verified, licence_verified,
            //              medical_verified, medical, licence, differences
        }

        ToastService.error('Booking Error', data.message);
    }
});
```

### Error response shapes from the API

```javascript
// Simple error
{ success: false, message: "You are not current on this aircraft type" }

// Error with details
{ success: false, message: "Cannot book", more: [{ name: "medical" }, { name: "licence_verified" }] }

// Overridable error (admin only)
{ success: false, message: "Instructor unavailable", allow_override: true, reason: "instructor", instructor: {...} }
```

---

## File Inventory

| File | Role |
|------|------|
| `js/services/toastService.js` | Toast factory — success/error/warning |
| `css/styles.css` | Toast CSS (payok-*, payfail-*, ta-warn-*) + field validation CSS (field-error, field-shake) |
| `js/controllers/bookings2Controller.js` | Reference implementation of `validateBookingFields()` |
| `views/bookings/new_add_booking.html` | Reference for `id="field-*"` attributes on form rows |

---

## Checklist for Future Work

When adding a new form or controller:

1. Inject `ToastService` into the controller
2. Write a `validateMyForm()` function following the pattern above
3. Add `id="field-*"` to each validatable `<tr>` in the HTML
4. Call validation before the submit action
5. Use `ToastService.error()` for all API failures
6. Use `ToastService.success()` for confirmations
7. Never use `alert()`, `confirm()`, or `prompt()`
