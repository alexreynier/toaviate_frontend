# Form Validation Audit — Mandated Fields

> Generated: 11 February 2026
> Summary of all forms audited and the required fields enforced.

---

## Approach

- **ToastService** extended with `validateForm(checks)`, `clearFieldError(event)`, and `highlightField(selector)` helper methods
- New forms use `ToastService.validateForm(...)` at the top of their `save()` / submit function
- Existing forms upgraded by adding `ToastService.highlightField()` before existing `ToastService.warning/error` calls
- jQuery `$().focus()` calls replaced with `ToastService.highlightField()` (native scrollIntoView + classList)
- Invalid fields are highlighted with the `.field-error-highlight` CSS class (red border, glow, pulse animation)
- The page scrolls to the first invalid field and focuses it
- Users clear the highlight by clicking/focusing the field (`ng-focus="vm.clearFieldError($event)"`)
- HTML `required` attributes added for native browser hints

---

## Files Modified

### Phase 1 — Forms with No Previous Validation
| File | Change |
|------|--------|
| `js/services/toastService.js` | Added `validateForm()`, `clearFieldError()`, and `highlightField()` methods |
| `js/controllers/dashboardClubSettingsController.js` | Added validation to `save()` |
| `js/controllers/dashboardClubPlanesController.js` | Added validation to `save()` |
| `js/controllers/dashboardClubMembershipsController.js` | Added validation to `save()` |
| `js/controllers/dashboardClubCourseController.js` | Added validation to `save()` |
| `js/controllers/dashboardClubLessonController.js` | Added validation to `save()` and `create()` |
| `js/controllers/dashboardClubItemsController.js` | Added validation to `save()` |
| `js/controllers/dashboardClubShopItemsController.js` | Added validation to `save()` |
| `js/controllers/dashboardClubInstructorChargesController.js` | Added validation to `save()` |
| `js/controllers/dashboardClubPackagesController.js` | Added validation to `save()` |
| `js/controllers/dashboardClubVouchersAddController.js` | Added validation to `save()` |
| `js/controllers/dashboardClubVouchersEditController.js` | Added validation to `save()` |
| `js/controllers/dashboardClubExperiencesController.js` | Added validation to `save()` |
| `js/controllers/dashboardClubExperienceDiscountsController.js` | Added validation to `save()` |
| `js/controllers/refundModalInstanceController.js` | Added ToastService injection + validation to `ok()` |
| `js/controllers/newChargeModalInstanceController.js` | Added ToastService injection + validation to `ok()` |
| `views/manageclub/settings.html` | Added `required`, `ng-required`, `ng-focus` to fields |
| `views/manageclub/plane_form.html` | Added `required`, `ng-focus` to ICAO Type, Seats |
| `views/manageclub/membership_form.html` | Added `required`, `ng-focus` to fields |
| `views/manageclub/course_form.html` | Added `required`, `ng-focus` to Title |
| `views/manageclub/lesson_form.html` | Added `required`, `ng-focus` to Title |
| `views/manageclub/item_form.html` | Added `required`, `ng-focus`, `id` to fields |
| `views/manageclub/shop_item_form.html` | Added `required`, `ng-focus` to fields |
| `views/manageclub/instructor_charges_form.html` | Added `required`, `ng-focus`, `id` to fields |
| `views/manageclub/packages_form.html` | Added `required`, `ng-focus` to fields |
| `views/manageclub/experiences_form.html` | Added `required`, `ng-focus` to fields |
| `views/manageclub/experience_discounts_form.html` | Added `required`, `ng-focus`, `id` to fields |
| `views/manageclub/voucher_form.html` | Added `required`, `ng-focus`, `id` to fields |
| `views/modals/refundModal.html` | Added `required`, fixed duplicate `name` attrs, added `id` attrs |

### Phase 2 — Upgrading Existing Validation to Full Pattern
| File | Change |
|------|--------|
| `js/controllers/loginController.js` | Injected ToastService, added `highlightField()` + validation |
| `js/controllers/registerController.js` | Injected ToastService, added `highlightField()` + validation, replaced FlashService |
| `js/controllers/passwordResetController.js` | Added `highlightField()` before all toasts/errors |
| `js/controllers/manageAccountController.js` | Added `highlightField()` before all `ToastService.warning()` calls |
| `js/controllers/manageNokController.js` | Added `validateForm(checks)` + `clearFieldError`, added success toasts |
| `js/controllers/manageLicenceController.js` | Replaced jQuery `.focus()` with `highlightField()`, fixed `show_loading` reset |
| `js/controllers/manageMedicalController.js` | Replaced jQuery `.focus()` with `highlightField()` |
| `js/controllers/managePoidController.js` | Replaced jQuery `.focus()` with `highlightField()`, fixed `show_loading` reset |
| `js/controllers/manageDifferencesController.js` | Replaced jQuery `.focus()` with `highlightField()` |
| `js/controllers/clubDocumentsController.js` | Replaced jQuery `.focus()` with `highlightField()` |
| `js/controllers/bookoutController.js` | Added `highlightField()` before all toasts, added error handling to API response |
| `js/controllers/bookinController.js` | Added `highlightField()`, fixed `=== NaN` bug, removed duplicate tacho check |
| `js/controllers/artpiecesController.js` | Injected ToastService, added validation + error handling |
| `views/register.html` | Fixed `form.firstName`/`form.lastName` name mismatch, fixed `id="Text1"` |
| `views/password_reset.html` | Changed `id="email"` → `id="reset_email"` |
| `views/password_reset2.html` | Changed `id="password"` → `id="new_password"` |
| `views/my_account/account.html` | Added `id` to `new_password`, `new_password2`, `password` inputs |
| `views/my_account/nok_form.html` | Added `id`, `ng-focus="vm.clearFieldError($event)"` to all fields |

---

## Mandated Fields Per Form

### 1. Club Settings (`manageclub/settings.html`)
| Field | Model | Condition |
|-------|-------|-----------|
| Trading As | `vm.club.settings.title` | Always required |
| Email | `vm.club.settings.email` | Always required |
| Registered Address | `vm.club.settings.address` | Always required |
| VAT Number | `vm.club.settings.vat_number` | Required if VAT Registered |
| VAT Rate | `vm.club.settings.vat_rate` | Required if VAT Registered |

### 2. Aircraft / Plane Form (`manageclub/plane_form.html`)
| Field | Model | Condition |
|-------|-------|-----------|
| Registration | `vm.plane_search.registration` | Required when adding new aircraft |
| ICAO Type | `vm.club.plane.plane_type` | Always required |
| Total Seats | `vm.club.plane.seats` | Always required |

### 3. Membership Form (`manageclub/membership_form.html`)
| Field | Model | Condition |
|-------|-------|-----------|
| Membership Name | `vm.club.membership.membership_name` | Always required |
| Payment Term | `vm.club.membership.payment_term` | Always required |
| Price | `vm.club.membership.price` | Required unless term is "free" |

### 4. Course Form (`manageclub/course_form.html`)
| Field | Model |
|-------|-------|
| Title | `vm.club.course.title` |

### 5. Lesson Form (`manageclub/lesson_form.html`)
| Field | Model |
|-------|-------|
| Title | `vm.club.lesson.title` |

### 6. Rental Item Form (`manageclub/item_form.html`)
| Field | Model |
|-------|-------|
| Title | `vm.club.item.title` |
| Cost | `vm.club.item.cost` |
| Number Available | `vm.club.item.number_available` |
| Cost Schedule | `vm.club.item.cost_schedule` |

### 7. Shop Item Form (`manageclub/shop_item_form.html`)
| Field | Model |
|-------|-------|
| Title | `vm.club.item.title` |
| Price | `vm.club.item.price` |

### 8. Instructor Charges Form (`manageclub/instructor_charges_form.html`)
| Field | Model |
|-------|-------|
| Instructing Type / Name | `vm.club.item.title` |
| Charged By | `vm.club.item.charge_type` |
| Cost per Unit | `vm.club.item.price` |

### 9. Packages Form (`manageclub/packages_form.html`)
| Field | Model |
|-------|-------|
| Title | `vm.package.title` |
| Price | `vm.package.price` |

### 10. Voucher Form — Add (`manageclub/voucher_form.html`)
| Field | Model | Condition |
|-------|-------|-----------|
| Experience | `vm.club.item.experience` | Always required |
| First Name | `vm.club.item.first_name` | Always required |
| Last Name | `vm.club.item.last_name` | Always required |
| Email | `vm.club.item.email` | Always required |
| Voucher Code | `vm.club.item.code` | Always required |
| Expiry Date | `vm.club.item.expiry_date` | Always required |
| Price Paid | `vm.club.item.price_paid` | Required if "Already Paid" checked |
| Payment Method | `vm.club.item.payment_method` | Required if "Already Paid" checked |

### 11. Voucher Form — Edit (uses same view)
| Field | Model |
|-------|-------|
| Experience | `vm.club.item.experience` |
| First Name | `vm.club.item.first_name` |
| Last Name | `vm.club.item.last_name` |
| Email | `vm.club.item.email` |
| Voucher Code | `vm.club.item.code` |
| Expiry Date | `vm.club.item.expiry_date` |

### 12. Experiences Form (`manageclub/experiences_form.html`)
| Field | Model |
|-------|-------|
| Title | `vm.club.item.title` |
| Price | `vm.club.item.price` |

### 13. Experience Discounts Form (`manageclub/experience_discounts_form.html`)
| Field | Model | Condition |
|-------|-------|-----------|
| Experience | `vm.club.item.experience` | Always required |
| Discount Type | `vm.club.item.discount_type` | Always required (must not be "0") |
| Discount Code | `vm.club.item.discount_code` | Always required |
| Discounted Price | `vm.club.item.price` | Required if type is Fixed Price |
| Discounted Percentage | `vm.club.item.percentage` | Required if type is Percentage |

### 14. Member Invite (`manageclub/member_invite.html`) — *Already validated before this audit*
| Field | Model |
|-------|-------|
| First Name | `vm.club.member.user.first_name` |
| Last Name | `vm.club.member.user.last_name` |
| Email | `vm.club.member.user.email` |
| Membership | `vm.club.member.membership_id` |
| Membership Start | `vm.club.member.membership_start` |

### 15. Refund Modal (`modals/refundModal.html`)
| Field | Model | Condition |
|-------|-------|-----------|
| Refund Amount | `to_refund` | Must be > 0 and ≤ remaining |
| Reason | `reason` | Always required |

### 16. New Charge Modal (`modals/newChargeModal.html`)
| Field | Model | Condition |
|-------|-------|-----------|
| Items | `items` | At least one item required |
| Client | `selected_client` | Must be selected |
| First Name | `new_client.first_name` | Required if "New Client" selected |
| Last Name | `new_client.last_name` | Required if "New Client" selected |
| Email | `new_client.email` | Required if "New Client" selected |

---

## Phase 2: Upgrading Previously-Validated Forms to Full Pattern

The following forms had *some* validation but lacked the full **ToastService + scroll + highlight** pattern. Each was upgraded as follows:

### 17. Login (`views/login.html`)
**Changes:** Injected `ToastService` into `LoginController`. Added pre-submit validation with `highlightField()` for email/password. Login failure errors now use `ToastService.error` with field highlighting.
| Field | Model |
|-------|-------|
| Email | `vm.email` |
| Password | `vm.password` |

### 18. Register (`views/register.html`)
**Changes:** Injected `ToastService` into `RegisterController`. Added pre-submit validation with `highlightField()` + password strength check. Replaced `FlashService` calls with `ToastService.success/error`. Fixed HTML bug where `form.firstName`/`form.lastName` didn't match input `name="first_name"`/`name="last_name"`. Fixed `id="Text1"` → `id="last_name"`.
| Field | Model |
|-------|-------|
| First Name | `vm.user.first_name` |
| Last Name | `vm.user.last_name` |
| Email | `vm.user.email` |
| Password | `vm.user.password` |

### 19. Password Reset (`views/password_reset.html`, `password_reset2.html`)
**Changes:** Added `highlightField()` before all ToastService/error messages. Added ToastService calls to replace bare `vm.show_error` boolean on empty/invalid email and short password. Updated HTML `id` attributes to `reset_email` / `new_password`.
| Field | Model |
|-------|-------|
| Email | `vm.email` |
| New Password | `vm.password` |

### 20. My Account (`views/my_account/account.html`)
**Changes:** Added `ToastService.highlightField()` before every existing `ToastService.warning()` call for phone, password mismatch, weak password, and current password. Added `id` attributes to `new_password`, `new_password2`, and `password` inputs.
| Field | Model | Condition |
|-------|-------|-----------|
| Phone Number | `vm.user.phone_number` | Always required |
| New Password | `vm.user.new_password` | Strength check if changing |
| Repeat Password | `vm.user.new_password2` | Must match if changing |
| Current Password | `vm.user.password` | Always required to save |

### 21. Next of Kin (`views/my_account/nok_form.html`)
**Changes:** Added `ToastService.validateForm(checks)` pre-submit validation (was previously submitting with no checks). Added `vm.clearFieldError`. Added `id` and `ng-focus` attributes to all fields. Added success toasts on create/update.
| Field | Model |
|-------|-------|
| First Name | `vm.nok.first_name` |
| Last Name | `vm.nok.last_name` |
| Phone Number | `vm.nok.phone_number` |
| Relationship | `vm.nok.relationship` |
| Address | `vm.nok.address` |

### 22. Licence Form (`manageLicenceController.js`)
**Changes:** Replaced jQuery `$(".drop").focus()` / `$("#id").focus()` with `ToastService.highlightField()` for scroll + red highlight. Fixed `show_loading` not being reset on early validation returns.
| Field | Validated |
|-------|-----------|
| Licence Images | ≥ 1 image required |
| Licence Type | `vm.licence.licence_type` |
| State of Issue | `vm.licence.state_of_issue` |
| Ratings | ≥ 1 rating required |

### 23. Medical Form (`manageMedicalController.js`)
**Changes:** Replaced jQuery `.focus()` with `ToastService.highlightField()` for scroll + red highlight.
| Field | Validated |
|-------|-----------|
| Medical Images | ≥ 1 image required |
| State of Issue | `vm.medical.state_of_issue` |
| Components | ≥ 1 component required |

### 24. Proof of ID Form (`managePoidController.js`)
**Changes:** Replaced jQuery `.focus()` with `ToastService.highlightField()`. Fixed `show_loading` not being reset on early validation returns.
| Field | Validated |
|-------|-----------|
| POID Images | ≥ 1 image required |
| Expiry Date | `vm.poid.expiry_date` |
| ID Type | `vm.poid.title` |

### 25. Differences Form (`manageDifferencesController.js`)
**Changes:** Replaced jQuery `.focus()` with `ToastService.highlightField()` for scroll + red highlight.
| Field | Validated |
|-------|-----------|
| Differences Images | ≥ 1 image required |
| Differences | ≥ 1 difference entry required |

### 26. Club Documents Form (`clubDocumentsController.js`)
**Changes:** Replaced jQuery `.focus()` with `ToastService.highlightField()` for scroll + red highlight.
| Field | Validated |
|-------|-----------|
| Document PDF | ≥ 1 PDF required |

### 27. Book Out (`bookoutController.js`)
**Changes:** Added `ToastService.highlightField()` before every existing `ToastService.warning()` call. Added error handling to `SendBookout().then()` (was navigating regardless of success/failure).
| Field | Validated |
|-------|-----------|
| Flight Type | `vm.bookout.flight_type` |
| Pilot In Command | `vm.bookout.pic` |
| Currency Confirmation | `vm.bookout.is_current` (when no instructor) |
| Destination | `vm.bookout.to_airfield` (when departure flight) |
| Defects Acknowledgement | `vm.bookout.accept_defects` (when defects exist) |

### 28. Book In (`bookinController.js`)
**Changes:** Added `ToastService.highlightField()` before existing ToastService calls. Fixed `vm.invoice_totals === NaN` (always false) → `isNaN(vm.invoice_totals)`. Removed duplicate `tacho_error_highlight` check.
| Field | Validated |
|-------|-----------|
| Tacho End | meter reading sanity check |
| Instructor | required if instructional flight |
| Tuition Type | required if instructor selected |

### 29. Artpieces (`artpiecesController.js`)
**Changes:** Injected `ToastService` (replaced `FlashService` for error handling). Added pre-submit validation with `highlightField()` for title. Added success/error toasts.
| Field | Validated |
|-------|-----------|
| Title | `vm.artpiece.title` |

---

## Forms Not Changed (Already Adequate or Not Applicable)

| Form | Reason |
|------|--------|
| Booking Add/Edit (`bookings2Controller`) | Already has full Toast + `.field-error` row highlighting + scroll |
| User Signup Wizard (`userSignupController`) | Multi-step wizard — redirects to relevant step + jQuery `.ng-invalid` class toggle + ToastService |
| Passenger Signup (`passengerSignupController`) | Multi-step wizard — same redirect + toast pattern |
| Passenger Signup Complete (`passengerSignupCompleteController`) | Verification code entry + password match with Toast |
| Invitations Signup (`invitationsSignupController`) | Multi-step wizard — redirect + toast + jQuery validation |
| Club Signup (`clubSignupController`) | Multi-step wizard — redirect + toast + jQuery validation |
| Payments Form | Stripe/Paybase iframe — no editable fields to validate |
| Edit User (`manageUserController`) | Uses FlashService — separate admin-facing form |
