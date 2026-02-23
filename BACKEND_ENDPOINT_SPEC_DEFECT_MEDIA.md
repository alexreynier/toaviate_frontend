# Backend Endpoint Spec — Defect Media (Photos & Videos)

> **Date:** 18 February 2026  
> **Status:** Frontend Complete — Backend Implementation Required  
> **Related frontend files:**  
> - `js/services/defectMediaService.js`  
> - `js/directives/defectMediaGallery.js`  
> - `js/directives/defectReportPanel.js`  
> - `css/defect-media.css`  
> - `css/defect-report.css`

---

## Overview

The frontend now supports uploading, viewing, and deleting photos & videos attached to plane defects. Media can be added either when creating a new defect (via the slide-in panel) or on existing defects (via the inline gallery).

| # | Feature | Endpoint(s) | DB Changes |
|---|---------|-------------|------------|
| 1 | Upload file to temp storage | `POST /upload_defect_media.php` | None (temp file) |
| 2 | Attach uploaded file to defect | `POST /api/v1/defect_media` | New `defect_media` table |
| 3 | List media for a defect | `GET /api/v1/defect_media/defect/{defect_id}` | — |
| 4 | Get single media item | `GET /api/v1/defect_media/{id}` | — |
| 5 | Serve file (full) | `GET /api/v1/defect_media/file/{stored_name}` | — |
| 6 | Serve thumbnail | `GET /api/v1/defect_media/thumbnail/{stored_name}` | — |
| 7 | Update sort order | `PUT /api/v1/defect_media/{id}` | — |
| 8 | Reorder batch | `PUT /api/v1/defect_media/reorder` | — |
| 9 | Delete media | `DELETE /api/v1/defect_media/{id}` | — |

---

## Database Migration

### New table: `defect_media`

```php
Schema::create('defect_media', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('defect_id');
    $table->unsignedBigInteger('club_id');
    $table->unsignedBigInteger('uploaded_by')->nullable();
    $table->string('original_name');
    $table->string('stored_name');
    $table->enum('media_type', ['image', 'video']);
    $table->unsignedBigInteger('file_size')->default(0);
    $table->string('mime_type')->nullable();
    $table->integer('sort_order')->default(0);
    $table->string('conversion_status')->default('none'); // none, pending, processing, complete, failed
    $table->timestamps();

    $table->foreign('defect_id')->references('id')->on('plane_tech_log_sheets')->onDelete('cascade');
    $table->foreign('club_id')->references('id')->on('clubs')->onDelete('cascade');
    $table->foreign('uploaded_by')->references('id')->on('users')->onDelete('set null');

    $table->index(['defect_id', 'sort_order']);
});
```

### Add `media_count` to defects (optional but recommended)

```php
Schema::table('plane_tech_log_sheets', function (Blueprint $table) {
    $table->unsignedInteger('media_count')->default(0)->after('status');
});
```

This avoids a COUNT query every time defects are listed. The frontend already reads `defect.media_count` to show badge icons on defect rows.

---

## 1. Upload File to Temp Storage

### Endpoint

```
POST https://local-api.toaviate.com/upload_defect_media.php
```

**Auth:** Authenticated  
**Content-Type:** `multipart/form-data`

### Request

| Field | Type | Rules |
|-------|------|-------|
| `file` | file | Required. Image (`jpg, jpeg, png, gif, heif, heic, webp`) or video (`mp4, mov, webm, avi, mkv, 3gp`). Max 20 MB for images, 100 MB for videos. |

### Processing

1. Validate file type and size
2. Generate a unique stored filename (e.g. UUID + original extension)
3. Save to a temp directory on the API server
4. Detect media type (`image` or `video`) from MIME type / extension
5. Return the temp path and metadata

### Response (Success)

```json
{
    "success": true,
    "saved_url": "temp/defect_media/a1b2c3d4-photo.jpg",
    "original_name": "cracked_windscreen.jpg",
    "media_type": "image"
}
```

### Response (Error)

```json
{
    "success": false,
    "message": "File exceeds maximum size of 20 MB."
}
```

---

## 2. Attach Uploaded File to Defect

### Endpoint

```
POST /api/v1/defect_media
```

**Auth:** Authenticated

### Request Body

```json
{
    "defect_id": 42,
    "club_id": 5,
    "temp_path": "temp/defect_media/a1b2c3d4-photo.jpg",
    "original_name": "cracked_windscreen.jpg",
    "media_type": "image",
    "sort_order": 0,
    "uploaded_by": 123
}
```

| Field | Type | Rules |
|-------|------|-------|
| `defect_id` | integer | Required. Must exist in `plane_tech_log_sheets`. |
| `club_id` | integer | Required. Must match the club that owns the defect's plane. |
| `temp_path` | string | Required. Path returned by the upload endpoint. |
| `original_name` | string | Required. Original filename. Max 255 chars. |
| `media_type` | string | Required. `image` or `video`. |
| `sort_order` | integer | Optional. Default `0`. |
| `uploaded_by` | integer | Optional (nullable). The `users.id` of the person uploading. |

### Processing

1. Validate the `defect_id` exists and belongs to `club_id`
2. Move the file from temp storage to permanent storage (e.g. `storage/defect_media/{club_id}/{stored_name}`)
3. Get file size
4. Insert record into `defect_media` table
5. Increment `media_count` on the defect record (if using the cached count)
6. For videos: optionally queue a conversion job and set `conversion_status = 'pending'`

### Response

```json
{
    "success": true,
    "media": {
        "id": 1,
        "defect_id": 42,
        "club_id": 5,
        "uploaded_by": 123,
        "original_name": "cracked_windscreen.jpg",
        "stored_name": "a1b2c3d4-photo.jpg",
        "media_type": "image",
        "file_size": 2456789,
        "mime_type": "image/jpeg",
        "sort_order": 0,
        "conversion_status": "none",
        "created_at": "2026-02-18T10:30:00.000000Z"
    }
}
```

---

## 3. List Media for a Defect

### Endpoint

```
GET /api/v1/defect_media/defect/{defect_id}
```

**Auth:** Authenticated

### Response

```json
{
    "success": true,
    "media": [
        {
            "id": 1,
            "defect_id": 42,
            "club_id": 5,
            "uploaded_by": 123,
            "original_name": "cracked_windscreen.jpg",
            "stored_name": "a1b2c3d4-photo.jpg",
            "media_type": "image",
            "file_size": 2456789,
            "mime_type": "image/jpeg",
            "sort_order": 0,
            "conversion_status": "none",
            "first_name": "John",
            "last_name": "Smith",
            "can_delete": true,
            "created_at": "2026-02-18T10:30:00.000000Z"
        }
    ]
}
```

### Important: `first_name`, `last_name`, and `can_delete`

Join against the `users` table on `uploaded_by` to include the uploader's name:

```php
$mediaItems = DB::table('defect_media')
    ->leftJoin('users', 'defect_media.uploaded_by', '=', 'users.id')
    ->where('defect_media.defect_id', $defectId)
    ->select('defect_media.*', 'users.first_name', 'users.last_name')
    ->orderBy('defect_media.sort_order')
    ->get();
```

Compute `can_delete` per item based on the authenticated user:

```php
$userId = auth()->user()->id;
$isClubAdmin = /* check if user is admin of the club that owns the defect's plane */;

foreach ($mediaItems as &$item) {
    $item->can_delete = $isClubAdmin || ($item->uploaded_by === $userId);
}
```

The frontend lightbox displays "Uploaded by {first_name} {last_name}" and the delete button only shows when `can_delete` is `true`.

---

## 4. Get Single Media Item

### Endpoint

```
GET /api/v1/defect_media/{id}
```

**Auth:** Authenticated

### Response

Same structure as a single item from the list endpoint above.

---

## 5. Serve File (Full Resolution)

### Endpoint

```
GET /api/v1/defect_media/file/{stored_name}
```

**Auth:** Authenticated  
**Response:** Binary file with appropriate `Content-Type` header

### Implementation

```php
$path = storage_path("defect_media/{$clubId}/{$storedName}");
return response()->file($path, [
    'Content-Type' => $media->mime_type,
]);
```

The frontend requests this as a blob (`responseType: 'blob'`) and creates an object URL for display in the lightbox.

---

## 6. Serve Thumbnail

### Endpoint

```
GET /api/v1/defect_media/thumbnail/{stored_name}
```

**Auth:** Authenticated  
**Response:** Binary file (resized image, e.g. 200×200)

### Implementation

Generate thumbnails on upload (or lazily on first request). For images, resize to ~200×200. For videos, extract a frame if possible, or return a generic video placeholder icon.

---

## 7. Update Sort Order

### Endpoint

```
PUT /api/v1/defect_media/{id}
```

**Auth:** Authenticated

### Request Body

```json
{
    "sort_order": 3
}
```

| Field | Type | Rules |
|-------|------|-------|
| `sort_order` | integer | Required. >= 0 |

### Response

```json
{
    "success": true,
    "media": { /* updated media item */ }
}
```

---

## 8. Reorder Batch

### Endpoint

```
PUT /api/v1/defect_media/reorder
```

**Auth:** Authenticated

### Request Body

```json
{
    "order": [
        { "id": 1, "sort_order": 0 },
        { "id": 3, "sort_order": 1 },
        { "id": 2, "sort_order": 2 }
    ]
}
```

### Response

```json
{
    "success": true,
    "message": "Sort order updated."
}
```

---

## 9. Delete Media

### Endpoint

```
DELETE /api/v1/defect_media/{id}
```

**Auth:** Authenticated

### Authorization — IMPORTANT

Only two types of user may delete defect media:

1. **An admin of the club** that owns the plane the defect belongs to
2. **The user who uploaded the media** (matched via `defect_media.uploaded_by`)

If neither condition is met, return `403`:

```json
{
    "success": false,
    "message": "You do not have permission to delete this media."
}
```

### Implementation

```php
public function destroy($id)
{
    $media = DefectMedia::findOrFail($id);
    $userId = auth()->user()->id;

    // Check: is user the uploader?
    $isUploader = $media->uploaded_by === $userId;

    // Check: is user a club admin?
    // Derive club from: defect_media.club_id, or via defect → plane → club
    $isClubAdmin = /* your existing club admin check for $media->club_id */;

    if (!$isUploader && !$isClubAdmin) {
        return response()->json([
            'success' => false,
            'message' => 'You do not have permission to delete this media.'
        ], 403);
    }

    // Delete file from storage
    Storage::delete("defect_media/{$media->club_id}/{$media->stored_name}");
    // Delete thumbnail if it exists
    Storage::delete("defect_media/{$media->club_id}/thumbs/{$media->stored_name}");

    // Decrement media_count on the defect (if using cached count)
    DB::table('plane_tech_log_sheets')
        ->where('id', $media->defect_id)
        ->decrement('media_count');

    $media->delete();

    return response()->json(['success' => true]);
}
```

### Response (Success)

```json
{
    "success": true
}
```

---

## Routes

Add to `routes/api.php`:

```php
// Defect media
Route::get('defect_media/defect/{defect_id}', [DefectMediaController::class, 'forDefect']);
Route::get('defect_media/file/{stored_name}', [DefectMediaController::class, 'serveFile']);
Route::get('defect_media/thumbnail/{stored_name}', [DefectMediaController::class, 'serveThumbnail']);
Route::get('defect_media/{id}', [DefectMediaController::class, 'show']);
Route::post('defect_media', [DefectMediaController::class, 'store']);
Route::put('defect_media/reorder', [DefectMediaController::class, 'reorder']);
Route::put('defect_media/{id}', [DefectMediaController::class, 'update']);
Route::delete('defect_media/{id}', [DefectMediaController::class, 'destroy']);
```

The upload endpoint is separate (PHP script, not Laravel route):

```
POST https://local-api.toaviate.com/upload_defect_media.php
```

---

## Frontend → Backend Request Map

| Frontend Method | HTTP | URL | Purpose |
|----------------|------|-----|---------|
| `DefectMediaService.UploadFile(file)` | POST | `https://local-api.toaviate.com/upload_defect_media.php` | Upload file to temp storage |
| `DefectMediaService.AttachToDefect(...)` | POST | `/api/v1/defect_media` | Attach temp file to defect (includes `uploaded_by`) |
| `DefectMediaService.UploadAndAttach(file, defectId, clubId, sortOrder, userId)` | — | Chains UploadFile → AttachToDefect | Combined convenience method |
| `DefectMediaService.GetForDefect(defectId)` | GET | `/api/v1/defect_media/defect/{defect_id}` | List all media for a defect |
| `DefectMediaService.GetById(id)` | GET | `/api/v1/defect_media/{id}` | Get single media item |
| `DefectMediaService.LoadFileUrl(storedName)` | GET | `/api/v1/defect_media/file/{stored_name}` | Serve full file as blob |
| `DefectMediaService.LoadThumbnailUrl(storedName)` | GET | `/api/v1/defect_media/thumbnail/{stored_name}` | Serve thumbnail as blob |
| `DefectMediaService.UpdateSortOrder(id, sortOrder)` | PUT | `/api/v1/defect_media/{id}` | Update single item sort order |
| `DefectMediaService.Reorder(orderArray)` | PUT | `/api/v1/defect_media/reorder` | Batch reorder |
| `DefectMediaService.Delete(id)` | DELETE | `/api/v1/defect_media/{id}` | Delete media (auth-gated) |

---

## File Storage Limits (enforced on frontend)

| Type | Max Size | Max Count Per Defect |
|------|----------|---------------------|
| Image | 20 MB | 10 |
| Video | 100 MB | 1 |
| Accepted image formats | `jpg, jpeg, png, gif, heif, heic, webp` | — |
| Accepted video formats | `mp4, mov, webm, avi, mkv, 3gp` | — |

These are validated on the frontend before upload. Backend should also enforce them.

---

## Testing Checklist

- [ ] Upload endpoint accepts images and videos within size limits
- [ ] Upload endpoint rejects unsupported file types and oversized files
- [ ] Attach endpoint creates `defect_media` record with `uploaded_by` populated
- [ ] Attach endpoint moves file from temp to permanent storage
- [ ] `media_count` on defect increments after attach
- [ ] List endpoint returns media with `first_name`, `last_name` from the uploader
- [ ] List endpoint computes `can_delete` correctly (club admin = true, uploader = true, anyone else = false)
- [ ] File serve endpoint returns correct binary with correct Content-Type
- [ ] Thumbnail serve endpoint returns resized image
- [ ] Delete endpoint allows club admin to delete any media
- [ ] Delete endpoint allows uploader to delete their own media
- [ ] Delete endpoint returns 403 for unauthorized users
- [ ] Delete endpoint removes file from storage
- [ ] Delete endpoint decrements `media_count` on defect
- [ ] Sort order updates work (single and batch)
