# Backend Endpoint Spec — Voucher Widget Enhancements

> **Date:** 18 February 2026  
> **Status:** Frontend Complete — Backend Implementation Required  
> **Migration:** Extends the existing `2026_02_17_000002` voucher widget migration  
> **Related frontend files:**  
> - `js/services/voucherWidgetService.js`  
> - `js/controllers/dashboardClubVoucherWidgetController.js`  
> - `views/manageclub/voucher_widget.html`  
> - `css/voucher-widget.css`

---

## Overview

Five enhancements have been implemented on the frontend and need backend support:

| # | Feature | New Endpoint(s) | DB Changes |
|---|---------|-----------------|------------|
| 1 | Widget Preview / Test Mode | `GET /preview_url/{club_id}` | None |
| 2 | Email Notifications | `GET` + `PUT /notifications/{club_id}` | New columns on `voucher_widget_tokens` |
| 3 | Refund Management | `POST /purchases/{club_id}/refund` | None (uses Stripe API) |
| 4 | Dark Mode Widget Option | — (existing settings endpoint) | New column on `voucher_widget_settings` |
| 5 | Custom Success Redirect URL | — (existing settings endpoint) | New column on `voucher_widget_settings` |

---

## 1. Widget Preview / Test Mode

### Purpose
Generate a temporary, signed preview URL that renders the voucher widget in a standalone page. This allows club managers to see exactly what customers will see before embedding on their website.

### Endpoint

```
GET /api/v1/voucher_widget_tokens/preview_url/{club_id}
```

**Auth:** Authenticated, club manager only  
**Rate limit:** Standard

### Response

```json
{
  "success": true,
  "preview_url": "https://local-api.toaviate.com/api/v1/voucher_widget/{token}/preview?sig=abc123&expires=1708300800"
}
```

> **⚠️ CRITICAL: Domain / URL mismatch bug**  
> Laravel's `URL::temporarySignedRoute()` generates URLs using the `APP_URL` env variable.  
> If `APP_URL` is set to the frontend domain (e.g. `local.toaviate.com`), the generated  
> preview URL will point to the **wrong server** and return a 404.  
> The preview URL **must** point to the **API domain** (e.g. `local-api.toaviate.com`,  
> `staging-api.toaviate.com`, or `api.toaviate.com` in production).  
>
> **Fix:** Do NOT rely on `URL::temporarySignedRoute()` alone. Instead, build the URL  
> manually using the API's own base URL, or temporarily override `APP_URL` when signing.  
> See the implementation example below.

### Implementation Notes

- Generate a short-lived signed URL (e.g. 30 minutes) using the club's widget token
- The preview URL should render the widget in a standalone HTML page at the public widget URL
- Add a `?preview=1` or signed parameter so the widget renders even if no allowed domains are configured
- The preview page should include a visible banner: "PREVIEW MODE — This is how your widget will appear to customers"
- The signed URL prevents abuse — it should expire and not be reusable
- **The URL must use the API domain**, not `APP_URL`. See options below:

#### Option A — Build the URL manually with HMAC signature

```php
public function previewUrl(int $club_id): JsonResponse
{
    $token = DB::table('voucher_widget_tokens')->where('club_id', $club_id)->first();
    if (!$token) {
        return response()->json(['success' => false, 'message' => 'No widget token found.'], 404);
    }

    $expires = now()->addMinutes(30)->getTimestamp();

    // Build the URL on the API domain (use config or env for the base)
    $apiBase = config('app.api_url', config('app.url')); // e.g. https://local-api.toaviate.com
    $path    = "/api/v1/voucher_widget/{$token->token}/preview";
    $url     = $apiBase . $path . '?' . http_build_query(['expires' => $expires]);

    // Sign it with the app key
    $signature = hash_hmac('sha256', $url, config('app.key'));
    $signedUrl = $url . '&sig=' . $signature;

    return response()->json(['success' => true, 'preview_url' => $signedUrl]);
}
```

Then in the preview route handler, verify:

```php
public function preview(string $token, Request $request)
{
    $expires = $request->query('expires');
    $sig     = $request->query('sig');

    // Rebuild the expected URL without the sig param to verify
    $apiBase     = config('app.api_url', config('app.url'));
    $expectedUrl = $apiBase . "/api/v1/voucher_widget/{$token}/preview?expires={$expires}";
    $expectedSig = hash_hmac('sha256', $expectedUrl, config('app.key'));

    if (!hash_equals($expectedSig, $sig) || $expires < now()->getTimestamp()) {
        abort(403, 'Invalid or expired preview link.');
    }

    // Render the widget preview page...
}
```

#### Option B — Temporarily override APP_URL for signing

```php
$originalUrl = config('app.url');
config(['app.url' => config('app.api_url')]); // swap to API domain
$signedUrl = URL::temporarySignedRoute('voucher-widget.preview', now()->addMinutes(30), ['token' => $token->token]);
config(['app.url' => $originalUrl]); // restore
```

#### Environment config needed

Add to `.env` (all environments):

```
API_URL=https://local-api.toaviate.com    # dev
# API_URL=https://staging-api.toaviate.com  # staging
# API_URL=https://api.toaviate.com          # production
```

Add to `config/app.php`:

```php
'api_url' => env('API_URL', env('APP_URL')),
```

### Frontend Usage

```javascript
// Opens in new window (480×700):
VoucherWidgetService.GetPreviewUrl(club_id)
  .then(function(data) {
      window.open(data.preview_url, '_blank', 'width=480,height=700');
  });

// Also supports inline iframe preview within the dashboard
```

---

## 2. Email Notifications

### Purpose
Allow club managers to opt-in to email notifications when vouchers are purchased or refunded through their widget.

### Database Migration

Add columns to `voucher_widget_tokens` table (or create a separate `voucher_widget_notification_preferences` table if preferred):

```php
Schema::table('voucher_widget_tokens', function (Blueprint $table) {
    $table->boolean('email_on_purchase')->default(false)->after('allowed_domains');
    $table->boolean('email_on_refund')->default(false)->after('email_on_purchase');
    $table->string('notification_email')->nullable()->after('email_on_refund');
});
```

### Endpoints

#### GET Notification Preferences

```
GET /api/v1/voucher_widget_tokens/notifications/{club_id}
```

**Auth:** Authenticated, club manager only

**Response:**

```json
{
  "success": true,
  "preferences": {
    "email_on_purchase": 0,
    "email_on_refund": 0,
    "notification_email": ""
  },
  "fallback_email": "info@flyingclub.co.uk"
}
```

> **`fallback_email`** — Return the club's email address from the club settings (`clubs.settings->email` or the club's `email` column). This is shown to the manager as a hint so they know where notifications will go if they leave the `notification_email` field blank.

#### PUT Update Notification Preferences

```
PUT /api/v1/voucher_widget_tokens/notifications/{club_id}
```

**Auth:** Authenticated, club manager only

**Request body:**

```json
{
  "email_on_purchase": 1,
  "email_on_refund": 1,
  "notification_email": "manager@flyingclub.co.uk"
}
```

**Validation rules:**

| Field | Type | Rules |
|-------|------|-------|
| `email_on_purchase` | boolean/int | Required, `0` or `1` |
| `email_on_refund` | boolean/int | Required, `0` or `1` |
| `notification_email` | string | Optional, valid email format, max 255 chars |

**Response:**

```json
{
  "success": true,
  "message": "Notification preferences updated."
}
```

### Email Sending Logic

When a widget purchase is completed (in the existing purchase flow):

1. Check `voucher_widget_tokens.email_on_purchase` for the club
2. If enabled, determine the recipient (in priority order):
   - Use `notification_email` if set (the custom address the club entered)
   - Otherwise fall back to the **club settings email** (`clubs.settings->email` or the club's `email` column)
   - As a last resort, fall back to the authenticated club admin's account email
3. Send an email with:
   - Subject: `"New Voucher Widget Purchase — {experience_title}"`
   - Body: buyer name, email, experience, amount, payment status, voucher code
   - Include a link back to the ToAviate dashboard purchases tab

When a refund is processed (see section 3 below):

1. Check `voucher_widget_tokens.email_on_refund` for the club
2. Same recipient priority logic as above (`notification_email` → club settings email → admin email)
3. Send an email with:
   - Subject: `"Voucher Widget Refund Processed — {amount}"`
   - Body: buyer name, experience, amount refunded, reason (if provided)

### Suggested Mailable Classes

```php
// App\Mail\VoucherWidgetPurchaseNotification
// App\Mail\VoucherWidgetRefundNotification
```

Use the existing ToAviate email template/layout for consistency.

---

## 3. Refund Management

### Purpose
Allow club managers to issue full refunds for widget purchases directly from the ToAviate dashboard, without needing to log into Stripe separately.

### Endpoint

```
POST /api/v1/voucher_widget_tokens/purchases/{club_id}/refund
```

**Auth:** Authenticated, club manager only

**Request body:**

```json
{
  "purchase_id": 42,
  "reason": "Customer requested cancellation"
}
```

**Validation rules:**

| Field | Type | Rules |
|-------|------|-------|
| `purchase_id` | integer | Required, must exist and belong to this club |
| `reason` | string | Optional, max 500 chars |

### Processing Logic

1. **Validate** the purchase exists and belongs to the club
2. **Check** the purchase `payment_status === 'succeeded'` (cannot refund pending/failed/already refunded)
3. **Check** the purchase has a valid `stripe_payment_intent_id`
4. **Call Stripe API** to create a refund:
   ```php
   $refund = \Stripe\Refund::create([
       'payment_intent' => $purchase->stripe_payment_intent_id,
       'reason' => 'requested_by_customer',  // Stripe enum
       'metadata' => [
           'club_id' => $club_id,
           'purchase_id' => $purchase->id,
           'admin_reason' => $request->reason,
           'refunded_by' => auth()->user()->email,
       ],
   ], [
       'stripe_account' => $club->stripe_id,  // Connected account
   ]);
   ```
5. **Update** the purchase record:
   ```php
   $purchase->payment_status = 'refunded';
   $purchase->refunded_at = now();
   $purchase->refund_reason = $request->reason;
   $purchase->stripe_refund_id = $refund->id;
   $purchase->save();
   ```
6. **Void/cancel** the associated voucher (set `voucher.status = 'cancelled'` or equivalent)
7. **Send refund notification email** if `email_on_refund` is enabled (see section 2)
8. **Log** the refund action for audit purposes

### Response (Success)

```json
{
  "success": true,
  "message": "Refund processed successfully.",
  "refund": {
    "id": "re_abc123",
    "amount": 12000,
    "currency": "gbp",
    "status": "succeeded"
  }
}
```

### Response (Error)

```json
{
  "success": false,
  "message": "This purchase has already been refunded."
}
```

### Error Scenarios

| Scenario | HTTP Status | Message |
|----------|-------------|---------|
| Purchase not found | 404 | "Purchase not found." |
| Purchase doesn't belong to club | 403 | "Unauthorized." |
| Already refunded | 422 | "This purchase has already been refunded." |
| Payment not succeeded | 422 | "Can only refund succeeded payments." |
| No Stripe PI | 422 | "No Stripe payment intent found for this purchase." |
| Stripe API error | 500 | "Stripe refund failed: {stripe_error_message}" |

### Database Migration (if not already present)

Add columns to the purchases table:

```php
Schema::table('voucher_widget_purchases', function (Blueprint $table) {
    $table->timestamp('refunded_at')->nullable()->after('completed_at');
    $table->string('refund_reason')->nullable()->after('refunded_at');
    $table->string('stripe_refund_id')->nullable()->after('refund_reason');
});
```

---

## 4. Dark Mode Widget Option

### Purpose
Allow clubs to toggle a "dark mode" preset for the widget, which automatically sets the colour scheme to dark-friendly defaults. The widget itself renders using the colour values — dark mode is purely a convenience toggle that sets appropriate colours.

### Database Migration

Add column to `voucher_widget_settings` table:

```php
Schema::table('voucher_widget_settings', function (Blueprint $table) {
    $table->boolean('dark_mode')->default(false)->after('show_images');
});
```

### Settings Endpoint Changes

The existing `PUT /api/v1/voucher_widget_tokens/settings/{club_id}` endpoint needs to accept the new field:

**Additional field in request body:**

```json
{
  "dark_mode": 1
}
```

**Validation:**

| Field | Type | Rules |
|-------|------|-------|
| `dark_mode` | boolean/int | Optional, `0` or `1`, defaults to `0` |

### Widget Rendering Impact

When `dark_mode = 1`, the frontend has already set these default colours:
- `background_colour`: `#1a1a2e`
- `text_colour`: `#e2e8f0`
- `primary_colour`: `#60a5fa`
- `secondary_colour`: `#3b82f6`

The public widget renderer should use the stored colour values regardless — the `dark_mode` flag is a UI convenience only. However, if you want the public widget to add a CSS class like `toaviate-widget--dark` for additional styling, check this flag when rendering.

### GET Settings Response (updated)

```json
{
  "success": true,
  "settings": {
    "primary_colour": "#60a5fa",
    "secondary_colour": "#3b82f6",
    "background_colour": "#1a1a2e",
    "text_colour": "#e2e8f0",
    "font_family": "Inter, system-ui, sans-serif",
    "border_radius": 8,
    "show_descriptions": 1,
    "show_images": 1,
    "dark_mode": 1,
    "button_text": "Buy Voucher",
    "success_message": null,
    "success_redirect_url": null
  }
}
```

---

## 5. Custom Success Redirect URL

### Purpose
After a successful purchase, redirect the customer to a custom URL on the club's website (e.g. a "Thank you" page) instead of showing the default in-widget success message.

### Database Migration

Add column to `voucher_widget_settings` table:

```php
Schema::table('voucher_widget_settings', function (Blueprint $table) {
    $table->string('success_redirect_url', 512)->nullable()->after('success_message');
});
```

### Settings Endpoint Changes

The existing `PUT /api/v1/voucher_widget_tokens/settings/{club_id}` endpoint needs to accept the new field:

**Additional field in request body:**

```json
{
  "success_redirect_url": "https://flyingclub.co.uk/thank-you"
}
```

**Validation:**

| Field | Type | Rules |
|-------|------|-------|
| `success_redirect_url` | string | Optional, nullable, valid URL format, max 512 chars |

### Public Widget Impact

In the public widget's payment success handler:

```javascript
// After successful payment:
if (settings.success_redirect_url) {
    // Append purchase info as query params so the club's page can display it
    var redirectUrl = settings.success_redirect_url;
    var separator = redirectUrl.indexOf('?') > -1 ? '&' : '?';
    redirectUrl += separator + 'voucher_code=' + encodeURIComponent(voucherCode);
    redirectUrl += '&purchase_id=' + purchaseId;
    redirectUrl += '&status=success';
    
    // Redirect the parent window (widget is in an iframe)
    window.top.location.href = redirectUrl;
} else {
    // Show default in-widget success message
    showSuccessScreen(settings.success_message || 'Thank you for your purchase!');
}
```

**Important security note:** Validate the `success_redirect_url` against the club's allowed domains (if set). If allowed domains are configured, the redirect URL's domain must match one of them to prevent open redirect vulnerabilities.

---

## Combined Migration

If you prefer a single migration for all changes:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Notification preferences on the token table
        Schema::table('voucher_widget_tokens', function (Blueprint $table) {
            $table->boolean('email_on_purchase')->default(false)->after('allowed_domains');
            $table->boolean('email_on_refund')->default(false)->after('email_on_purchase');
            $table->string('notification_email')->nullable()->after('email_on_refund');
        });

        // Dark mode + success redirect on the settings table
        Schema::table('voucher_widget_settings', function (Blueprint $table) {
            $table->boolean('dark_mode')->default(false)->after('show_images');
            $table->string('success_redirect_url', 512)->nullable()->after('success_message');
        });

        // Refund tracking on the purchases table
        Schema::table('voucher_widget_purchases', function (Blueprint $table) {
            $table->timestamp('refunded_at')->nullable()->after('completed_at');
            $table->string('refund_reason')->nullable()->after('refunded_at');
            $table->string('stripe_refund_id')->nullable()->after('refund_reason');
        });
    }

    public function down(): void
    {
        Schema::table('voucher_widget_tokens', function (Blueprint $table) {
            $table->dropColumn(['email_on_purchase', 'email_on_refund', 'notification_email']);
        });

        Schema::table('voucher_widget_settings', function (Blueprint $table) {
            $table->dropColumn(['dark_mode', 'success_redirect_url']);
        });

        Schema::table('voucher_widget_purchases', function (Blueprint $table) {
            $table->dropColumn(['refunded_at', 'refund_reason', 'stripe_refund_id']);
        });
    }
};
```

---

## Routes Summary

Add to `routes/api.php` within the existing voucher widget authenticated group:

```php
// Existing routes...
// GET    /voucher_widget_tokens/{club_id}
// POST   /voucher_widget_tokens
// DELETE /voucher_widget_tokens/{club_id}
// GET    /voucher_widget_tokens/settings/{club_id}
// PUT    /voucher_widget_tokens/settings/{club_id}
// PUT    /voucher_widget_tokens/domains/{club_id}
// GET    /voucher_widget_tokens/purchases/{club_id}

// NEW routes:
Route::get('voucher_widget_tokens/preview_url/{club_id}', [VoucherWidgetController::class, 'previewUrl']);
Route::get('voucher_widget_tokens/notifications/{club_id}', [VoucherWidgetController::class, 'getNotifications']);
Route::put('voucher_widget_tokens/notifications/{club_id}', [VoucherWidgetController::class, 'updateNotifications']);
Route::post('voucher_widget_tokens/purchases/{club_id}/refund', [VoucherWidgetController::class, 'refundPurchase']);
```

---

## Controller Methods Summary

```php
class VoucherWidgetController extends Controller
{
    // ... existing methods ...

    /**
     * Generate a short-lived signed preview URL
     */
    public function previewUrl(int $club_id): JsonResponse
    {
        // 1. Verify auth + club ownership
        // 2. Verify token exists
        // 3. Generate signed URL with 30-min expiry
        //    ⚠️ IMPORTANT: URL must use API_URL (config('app.api_url')),
        //    NOT APP_URL, otherwise the preview link will 404.
        //    See "Option A" or "Option B" in section 1 above.
        // 4. Return { success: true, preview_url: "..." }
    }

    /**
     * Get notification preferences for the widget
     */
    public function getNotifications(int $club_id): JsonResponse
    {
        // 1. Verify auth + club ownership
        // 2. Get token → return email_on_purchase, email_on_refund, notification_email
        // 3. Also return fallback_email from club settings email (clubs.settings->email or clubs.email)
    }

    /**
     * Update notification preferences
     */
    public function updateNotifications(Request $request, int $club_id): JsonResponse
    {
        // 1. Verify auth + club ownership
        // 2. Validate input
        // 3. Update voucher_widget_tokens record
        // 4. Return success
    }

    /**
     * Process a full refund via Stripe
     */
    public function refundPurchase(Request $request, int $club_id): JsonResponse
    {
        // 1. Verify auth + club ownership
        // 2. Find purchase, validate it can be refunded
        // 3. Call Stripe Refund API on the connected account
        // 4. Update purchase record (status, refunded_at, stripe_refund_id)
        // 5. Void/cancel the associated voucher
        // 6. Send refund notification email if enabled
        // 7. Return success + refund details
    }
}
```

---

## Frontend → Backend Request Map

| Frontend Method | HTTP | URL | Purpose |
|----------------|------|-----|---------|
| `VoucherWidgetService.GetPreviewUrl(club_id)` | GET | `/api/v1/voucher_widget_tokens/preview_url/{club_id}` | Generate preview URL |
| `VoucherWidgetService.GetNotificationPreferences(club_id)` | GET | `/api/v1/voucher_widget_tokens/notifications/{club_id}` | Load notification prefs |
| `VoucherWidgetService.UpdateNotificationPreferences(club_id, prefs)` | PUT | `/api/v1/voucher_widget_tokens/notifications/{club_id}` | Save notification prefs |
| `VoucherWidgetService.RefundPurchase(club_id, purchase_id, reason)` | POST | `/api/v1/voucher_widget_tokens/purchases/{club_id}/refund` | Process Stripe refund |
| `VoucherWidgetService.UpdateSettings(club_id, settings)` | PUT | `/api/v1/voucher_widget_tokens/settings/{club_id}` | Now includes `dark_mode` + `success_redirect_url` |
| `VoucherWidgetService.GetSettings(club_id)` | GET | `/api/v1/voucher_widget_tokens/settings/{club_id}` | Now returns `dark_mode` + `success_redirect_url` |

---

## Testing Checklist

- [ ] Preview URL generates correctly and expires after 30 minutes
- [ ] Preview page renders the widget with current settings
- [ ] Preview bypasses domain restrictions
- [ ] Notification preferences save and load correctly
- [ ] Purchase notification email sends when `email_on_purchase = 1`
- [ ] Falls back to club settings email when `notification_email` is blank (then admin email as last resort)
- [ ] Refund calls Stripe API on the connected account correctly
- [ ] Refund updates purchase status to `refunded` with timestamp
- [ ] Refund voids the associated voucher
- [ ] Refund notification email sends when `email_on_refund = 1`
- [ ] Cannot refund already-refunded purchases (returns 422)
- [ ] Cannot refund pending/failed purchases (returns 422)
- [ ] `dark_mode` flag persists through settings save/load cycle
- [ ] `success_redirect_url` persists through settings save/load cycle
- [ ] Public widget redirects to `success_redirect_url` after purchase (if set)
- [ ] Redirect URL is validated against allowed domains (if configured)
- [ ] All new endpoints require authentication and club ownership
