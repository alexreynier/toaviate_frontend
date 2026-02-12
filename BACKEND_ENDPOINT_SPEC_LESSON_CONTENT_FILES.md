# Backend Endpoint Specification: Lesson Content File Uploads

## Overview

The frontend has been updated to allow lesson content to be created either via the existing form-based approach (TEM, Pre-Flight, Air Exercises, Debrief) **or** by uploading image/PDF files directly. This document specifies the backend endpoints that need to be built to support this feature.

The frontend uses AngularJS 1.x and communicates via `$http` through `CourseService`. All existing API endpoints follow the pattern `/api/v1/<resource>`.

---

## Database Schema

### New Table: `lesson_content_files`

| Column            | Type         | Notes                                              |
|-------------------|--------------|----------------------------------------------------|
| `id`              | INT (PK)     | Auto-increment                                     |
| `lesson_id`       | INT (FK)     | References `lessons.id`                            |
| `file_type`       | VARCHAR(10)  | `'image'` or `'pdf'`                               |
| `original_name`   | VARCHAR(255) | Original filename as uploaded                      |
| `stored_name`     | VARCHAR(255) | Server-generated stored filename (UUID-based)      |
| `file_path`       | VARCHAR(512) | Relative server path to stored file                |
| `file_url`        | VARCHAR(512) | Public-accessible URL for frontend display         |
| `file_size`       | BIGINT       | File size in bytes                                 |
| `mime_type`       | VARCHAR(100) | e.g. `image/png`, `image/jpeg`, `application/pdf`  |
| `pdf_pages`       | VARCHAR(20)  | Comma-separated page numbers if PDF (e.g. `"1,2"`) — NULL for images |
| `organise`        | INT          | Display order (0-indexed)                          |
| `created_at`      | DATETIME     | Auto-set on creation                               |
| `updated_at`      | DATETIME     | Auto-set on update                                 |
| `deleted_at`      | DATETIME     | Soft-delete (nullable)                             |

**Index:** `lesson_id` + `deleted_at IS NULL`

---

## Endpoints

### 1. GET `/api/v1/lesson_content_files/lesson/:lesson_id`

**Purpose:** Retrieve all content files for a specific lesson, **ordered by the `organise` column ascending**.

**Auth:** Requires authenticated user who is an admin/instructor for the club that owns the course containing this lesson.

**Response (200):**
```json
{
  "success": true,
  "items": [
    {
      "id": 1,
      "lesson_id": 29,
      "file_type": "image",
      "original_name": "preflight_checklist.png",
      "stored_name": "abc123-uuid.png",
      "file_path": "/uploads/lesson_content/abc123-uuid.png",
      "file_url": "https://api.toaviate.com/uploads/lesson_content/abc123-uuid.png",
      "file_size": 245678,
      "mime_type": "image/png",
      "pdf_pages": null,
      "organise": 0,
      "created_at": "2026-02-12T10:30:00Z"
    },
    {
      "id": 2,
      "lesson_id": 29,
      "file_type": "pdf",
      "original_name": "lesson_brief.pdf",
      "stored_name": "def456-uuid.pdf",
      "file_path": "/uploads/lesson_content/def456-uuid.pdf",
      "file_url": "https://api.toaviate.com/uploads/lesson_content/def456-uuid.pdf",
      "file_size": 1048576,
      "mime_type": "application/pdf",
      "pdf_pages": "1,3",
      "organise": 1,
      "created_at": "2026-02-12T10:35:00Z"
    }
  ]
}
```

**Response (404):** Lesson not found.

---

### 2. POST `/api/v1/lesson_content_files`

**Purpose:** Upload a new content file for a lesson.

**Auth:** Requires authenticated user who is an admin/instructor for the club that owns the course containing this lesson.

**Request:** `multipart/form-data`

| Field        | Type     | Required | Notes                                           |
|--------------|----------|----------|-------------------------------------------------|
| `file`       | File     | Yes      | The file being uploaded (PNG, JPG, JPEG, or PDF) |
| `lesson_id`  | Integer  | Yes      | The lesson this content belongs to               |
| `file_type`  | String   | Yes      | `'image'` or `'pdf'`                             |
| `pdf_pages`  | String   | No*      | JSON-encoded array of page numbers, e.g. `"[1,2]"`. **Required** if `file_type` is `'pdf'` |

**Server-side validation:**
- `file` must be one of: `image/png`, `image/jpeg`, `application/pdf`
- Maximum file size: 20MB
- If `file_type` is `'pdf'`, `pdf_pages` must be provided and must contain 1-2 page numbers
- `lesson_id` must exist and belong to a course owned by the authenticated user's club

**Server-side processing for PDFs:**
- When `pdf_pages` is provided, the server should:
  1. Store the original PDF file
  2. Extract the selected pages and generate individual PNG/JPEG renderings for preview thumbnails
  3. Store the `pdf_pages` value as a comma-separated string (e.g., `"1,2"`)
- *Alternatively*, if you prefer a simpler approach: just store the PDF and the page numbers — the frontend already generates thumbnails client-side for display

**Response (201):**
```json
{
  "success": true,
  "item": {
    "id": 3,
    "lesson_id": 29,
    "file_type": "image",
    "original_name": "air_exercises.jpg",
    "stored_name": "ghi789-uuid.jpg",
    "file_path": "/uploads/lesson_content/ghi789-uuid.jpg",
    "file_url": "https://api.toaviate.com/uploads/lesson_content/ghi789-uuid.jpg",
    "file_size": 350000,
    "mime_type": "image/jpeg",
    "pdf_pages": null,
    "organise": 2,
    "created_at": "2026-02-12T11:00:00Z"
  }
}
```

**Response (400):**
```json
{
  "success": false,
  "message": "Invalid file type. Allowed: PNG, JPG, PDF."
}
```

**Response (413):**
```json
{
  "success": false,
  "message": "File exceeds the maximum allowed size of 20MB."
}
```

---

### 3. POST `/api/v1/lesson_content_files/:id`

**Purpose:** Replace/update an existing content file (used for the "replace" functionality).

**Note:** Using POST instead of PUT because the request is `multipart/form-data`.

**Auth:** Same as above — the file must belong to a lesson in a course owned by the user's club.

**Request:** `multipart/form-data`

| Field        | Type     | Required | Notes                                 |
|--------------|----------|----------|---------------------------------------|
| `file`       | File     | Yes      | The replacement file                  |
| `lesson_id`  | Integer  | Yes      | The lesson ID (for validation)        |
| `file_type`  | String   | Yes      | `'image'` or `'pdf'`                  |
| `pdf_pages`  | String   | No*      | Required if PDF                       |

**Server-side behaviour:**
- Delete (or archive) the old stored file
- Store the new file with a new `stored_name`
- Update the database record
- Return the updated record

**Response (200):**
```json
{
  "success": true,
  "item": {
    "id": 3,
    "lesson_id": 29,
    "file_type": "pdf",
    "original_name": "updated_brief.pdf",
    "stored_name": "jkl012-uuid.pdf",
    "file_path": "/uploads/lesson_content/jkl012-uuid.pdf",
    "file_url": "https://api.toaviate.com/uploads/lesson_content/jkl012-uuid.pdf",
    "file_size": 520000,
    "mime_type": "application/pdf",
    "pdf_pages": "2",
    "organise": 2,
    "created_at": "2026-02-12T11:00:00Z"
  }
}
```

---

### 4. DELETE `/api/v1/lesson_content_files/:id`

**Purpose:** Delete a content file.

**Auth:** Same as above.

**Server-side behaviour:**
- Soft-delete the database record (set `deleted_at`)
- Optionally delete or archive the physical file
- Return success

**Response (200):**
```json
{
  "success": true,
  "message": "File deleted successfully."
}
```

**Response (404):**
```json
{
  "success": false,
  "message": "File not found."
}
```

---

### 5. POST `/api/v1/lesson_content_files/organise`

**Purpose:** Update the display order of content files for a lesson. This allows instructors to drag-and-drop files into the order they want students/instructors to see them.

**Auth:** Same as above — the user must have admin/instructor privileges for the club.

**Request:** `application/json`

```json
{
  "order": [
    { "id": 3, "organise": 0 },
    { "id": 1, "organise": 1 },
    { "id": 2, "organise": 2 }
  ]
}
```

| Field          | Type    | Notes                                              |
|----------------|---------|----------------------------------------------------|
| `order`        | Array   | Array of objects, each with `id` and `organise`    |
| `order[].id`   | Integer | The `lesson_content_files.id`                      |
| `order[].organise` | Integer | The new 0-indexed display order position       |

**Server-side behaviour:**
- Iterate over the `order` array and update the `organise` column for each record
- Validate that all IDs belong to the same lesson and that the user has permission
- This follows the exact same pattern as the existing `/api/v1/lesson_items/organise`, `/api/v1/lesson_bullets/organise`, and `/api/v1/lesson_tem/organise` endpoints

**Response (200):**
```json
{
  "success": true,
  "message": "Order updated successfully."
}
```

**Response (400):**
```json
{
  "success": false,
  "message": "Invalid order data."
}
```

---

## File Storage

**Recommended directory:** `/uploads/lesson_content/`

- Files should be stored with a UUID-based name to prevent collisions: `{uuid}.{extension}`
- The `file_url` returned should be a fully-qualified URL accessible by the frontend
- If the current infrastructure uses a CDN or cloud storage (e.g., S3), adapt accordingly

---

## Frontend Service Calls (for reference)

The frontend calls these endpoints via `CourseService` in `js/services/courseService.js`:

```javascript
// GET all content files for a lesson (ordered by `organise` ASC)
CourseService.GetLessonContentFiles(lesson_id)

// POST upload new file (multipart/form-data)
CourseService.UploadLessonContentFile(formData)

// POST replace existing file (multipart/form-data)  
CourseService.UpdateLessonContentFile(id, formData)

// DELETE a content file
CourseService.DeleteLessonContentFile(id)

// POST update display order
CourseService.UpdateLessonContentFilesOrder({ order: [...] })
```

The `UploadLessonContentFile` and `UpdateLessonContentFile` methods send with:
```javascript
{
    transformRequest: angular.identity,
    headers: { 'Content-Type': undefined }  // let browser set multipart boundary
}
```

---

## Error Handling Convention

Follow the existing project convention for error responses:

```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

HTTP status codes:
- `200` — Success (GET, PUT, DELETE)
- `201` — Created (POST new file)
- `400` — Bad request / validation error
- `401` — Unauthorized (handled globally by frontend interceptor)
- `404` — Resource not found
- `413` — File too large
- `500` — Server error

---

## Security Considerations

1. **Authorization:** Ensure the authenticated user has admin/instructor privileges for the club that owns the course & lesson
2. **File validation:** Validate MIME type server-side (don't trust `Content-Type` header alone — inspect file magic bytes)
3. **Filename sanitization:** Never use the original filename for storage. Generate a UUID-based name.
4. **Path traversal:** Ensure uploaded files cannot escape the designated upload directory
5. **Size limits:** Enforce 20MB max at the web server level (e.g., nginx `client_max_body_size`) and application level
