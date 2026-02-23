# Backend Changes Required — Defect Media

> **Date:** 18 February 2026  
> **Priority:** Required for defect media feature to function

---

## 1. Database Migration

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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
            $table->string('conversion_status')->default('none');
            $table->timestamps();

            $table->foreign('defect_id')->references('id')->on('plane_tech_log_sheets')->onDelete('cascade');
            $table->foreign('club_id')->references('id')->on('clubs')->onDelete('cascade');
            $table->foreign('uploaded_by')->references('id')->on('users')->onDelete('set null');

            $table->index(['defect_id', 'sort_order']);
        });

        Schema::table('plane_tech_log_sheets', function (Blueprint $table) {
            $table->unsignedInteger('media_count')->default(0)->after('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('defect_media');

        Schema::table('plane_tech_log_sheets', function (Blueprint $table) {
            $table->dropColumn('media_count');
        });
    }
};
```

---

## 2. Upload Script

**File:** `upload_defect_media.php` (on the API server)  
**URL:** `POST https://local-api.toaviate.com/upload_defect_media.php`

```php
<?php
// Accepts multipart/form-data with a single 'file' field.
// Validates type and size, saves to temp directory, returns metadata.

header('Content-Type: application/json');

$allowed_image_ext = ['jpg', 'jpeg', 'png', 'gif', 'heif', 'heic', 'webp'];
$allowed_video_ext = ['mp4', 'mov', 'webm', 'avi', 'mkv', '3gp'];
$max_image_size = 20 * 1024 * 1024;   // 20 MB
$max_video_size = 100 * 1024 * 1024;  // 100 MB

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_FILES['file'])) {
    echo json_encode(['success' => false, 'message' => 'No file provided.']);
    exit;
}

$file = $_FILES['file'];
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

$is_image = in_array($ext, $allowed_image_ext);
$is_video = in_array($ext, $allowed_video_ext);

if (!$is_image && !$is_video) {
    echo json_encode(['success' => false, 'message' => 'Unsupported file type: ' . $ext]);
    exit;
}

if ($is_image && $file['size'] > $max_image_size) {
    echo json_encode(['success' => false, 'message' => 'Image exceeds maximum size of 20 MB.']);
    exit;
}

if ($is_video && $file['size'] > $max_video_size) {
    echo json_encode(['success' => false, 'message' => 'Video exceeds maximum size of 100 MB.']);
    exit;
}

$stored_name = uniqid('defect_', true) . '.' . $ext;
$temp_dir = __DIR__ . '/storage/temp/defect_media/';

if (!is_dir($temp_dir)) {
    mkdir($temp_dir, 0755, true);
}

$dest = $temp_dir . $stored_name;

if (move_uploaded_file($file['tmp_name'], $dest)) {
    echo json_encode([
        'success'       => true,
        'saved_url'     => 'temp/defect_media/' . $stored_name,
        'original_name' => $file['name'],
        'media_type'    => $is_image ? 'image' : 'video',
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to save uploaded file.']);
}
```

---

## 3. Routes

Add to `routes/api.php`:

```php
Route::get('defect_media/defect/{defect_id}', [DefectMediaController::class, 'forDefect']);
Route::get('defect_media/file/{stored_name}', [DefectMediaController::class, 'serveFile']);
Route::get('defect_media/thumbnail/{stored_name}', [DefectMediaController::class, 'serveThumbnail']);
Route::get('defect_media/{id}', [DefectMediaController::class, 'show']);
Route::post('defect_media', [DefectMediaController::class, 'store']);
Route::put('defect_media/reorder', [DefectMediaController::class, 'reorder']);
Route::put('defect_media/{id}', [DefectMediaController::class, 'update']);
Route::delete('defect_media/{id}', [DefectMediaController::class, 'destroy']);
```

---

## 4. Controller

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class DefectMediaController extends Controller
{
    /**
     * POST /api/v1/defect_media
     * Attach an uploaded temp file to a defect.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'defect_id'     => 'required|integer|exists:plane_tech_log_sheets,id',
            'club_id'       => 'required|integer|exists:clubs,id',
            'temp_path'     => 'required|string',
            'original_name' => 'required|string|max:255',
            'media_type'    => 'required|in:image,video',
            'sort_order'    => 'integer|min:0',
            'uploaded_by'   => 'nullable|integer|exists:users,id',
        ]);

        $tempFullPath = storage_path($request->temp_path);
        if (!file_exists($tempFullPath)) {
            return response()->json(['success' => false, 'message' => 'Temp file not found.'], 422);
        }

        $stored_name = basename($request->temp_path);
        $permanent_dir = "defect_media/{$request->club_id}";

        // Move from temp to permanent
        if (!Storage::exists($permanent_dir)) {
            Storage::makeDirectory($permanent_dir);
        }
        rename($tempFullPath, storage_path("app/{$permanent_dir}/{$stored_name}"));

        $file_size = filesize(storage_path("app/{$permanent_dir}/{$stored_name}"));
        $mime_type = mime_content_type(storage_path("app/{$permanent_dir}/{$stored_name}"));

        // Generate thumbnail for images
        // (implement as needed — e.g. Intervention Image to resize to 200x200)

        $id = DB::table('defect_media')->insertGetId([
            'defect_id'         => $request->defect_id,
            'club_id'           => $request->club_id,
            'uploaded_by'       => $request->uploaded_by,
            'original_name'     => $request->original_name,
            'stored_name'       => $stored_name,
            'media_type'        => $request->media_type,
            'file_size'         => $file_size,
            'mime_type'         => $mime_type,
            'sort_order'        => $request->sort_order ?? 0,
            'conversion_status' => 'none',
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        // Increment cached count
        DB::table('plane_tech_log_sheets')
            ->where('id', $request->defect_id)
            ->increment('media_count');

        $media = DB::table('defect_media')->where('id', $id)->first();

        return response()->json(['success' => true, 'media' => $media]);
    }

    /**
     * GET /api/v1/defect_media/defect/{defect_id}
     * List all media for a defect with uploader name and can_delete flag.
     */
    public function forDefect(int $defect_id): JsonResponse
    {
        $userId = auth()->user()->id;

        $media = DB::table('defect_media')
            ->leftJoin('users', 'defect_media.uploaded_by', '=', 'users.id')
            ->where('defect_media.defect_id', $defect_id)
            ->select(
                'defect_media.*',
                'users.first_name',
                'users.last_name'
            )
            ->orderBy('defect_media.sort_order')
            ->get();

        // Determine club admin status
        $clubId = optional($media->first())->club_id;
        $isClubAdmin = false;
        if ($clubId) {
            // Replace with your existing club admin check:
            $isClubAdmin = DB::table('club_user')
                ->where('club_id', $clubId)
                ->where('user_id', $userId)
                ->where('role', 'admin')
                ->exists();
        }

        $media->transform(function ($item) use ($userId, $isClubAdmin) {
            $item->can_delete = $isClubAdmin || ($item->uploaded_by == $userId);
            return $item;
        });

        return response()->json(['success' => true, 'media' => $media]);
    }

    /**
     * GET /api/v1/defect_media/{id}
     */
    public function show(int $id): JsonResponse
    {
        $media = DB::table('defect_media')
            ->leftJoin('users', 'defect_media.uploaded_by', '=', 'users.id')
            ->where('defect_media.id', $id)
            ->select('defect_media.*', 'users.first_name', 'users.last_name')
            ->first();

        if (!$media) {
            return response()->json(['success' => false, 'message' => 'Not found.'], 404);
        }

        return response()->json(['success' => true, 'media' => $media]);
    }

    /**
     * GET /api/v1/defect_media/file/{stored_name}
     * Serve the full-resolution file as binary.
     */
    public function serveFile(string $stored_name)
    {
        $media = DB::table('defect_media')->where('stored_name', $stored_name)->first();
        if (!$media) {
            return response()->json(['success' => false, 'message' => 'Not found.'], 404);
        }

        $path = storage_path("app/defect_media/{$media->club_id}/{$stored_name}");
        if (!file_exists($path)) {
            return response()->json(['success' => false, 'message' => 'File not found.'], 404);
        }

        return response()->file($path, [
            'Content-Type' => $media->mime_type ?? 'application/octet-stream',
        ]);
    }

    /**
     * GET /api/v1/defect_media/thumbnail/{stored_name}
     * Serve a resized thumbnail (200x200).
     */
    public function serveThumbnail(string $stored_name)
    {
        $media = DB::table('defect_media')->where('stored_name', $stored_name)->first();
        if (!$media) {
            return response()->json(['success' => false, 'message' => 'Not found.'], 404);
        }

        $thumbPath = storage_path("app/defect_media/{$media->club_id}/thumbs/{$stored_name}");

        // If thumbnail doesn't exist yet, generate it (or fall back to full file)
        if (!file_exists($thumbPath)) {
            $fullPath = storage_path("app/defect_media/{$media->club_id}/{$stored_name}");
            if (!file_exists($fullPath)) {
                return response()->json(['success' => false, 'message' => 'File not found.'], 404);
            }

            // Generate thumbnail — example using Intervention Image:
            // $img = Image::make($fullPath)->fit(200, 200);
            // if (!is_dir(dirname($thumbPath))) mkdir(dirname($thumbPath), 0755, true);
            // $img->save($thumbPath);

            // Fallback: serve full file if thumbnail generation not yet implemented
            return response()->file($fullPath, [
                'Content-Type' => $media->mime_type ?? 'application/octet-stream',
            ]);
        }

        return response()->file($thumbPath, [
            'Content-Type' => $media->mime_type ?? 'image/jpeg',
        ]);
    }

    /**
     * PUT /api/v1/defect_media/{id}
     * Update sort order for a single item.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'sort_order' => 'required|integer|min:0',
        ]);

        DB::table('defect_media')->where('id', $id)->update([
            'sort_order'  => $request->sort_order,
            'updated_at'  => now(),
        ]);

        $media = DB::table('defect_media')->where('id', $id)->first();

        return response()->json(['success' => true, 'media' => $media]);
    }

    /**
     * PUT /api/v1/defect_media/reorder
     * Batch update sort order.
     */
    public function reorder(Request $request): JsonResponse
    {
        $request->validate([
            'order'              => 'required|array',
            'order.*.id'         => 'required|integer|exists:defect_media,id',
            'order.*.sort_order' => 'required|integer|min:0',
        ]);

        foreach ($request->order as $item) {
            DB::table('defect_media')->where('id', $item['id'])->update([
                'sort_order' => $item['sort_order'],
                'updated_at' => now(),
            ]);
        }

        return response()->json(['success' => true, 'message' => 'Sort order updated.']);
    }

    /**
     * DELETE /api/v1/defect_media/{id}
     * Delete media — only club admin or the uploader may delete.
     */
    public function destroy(int $id): JsonResponse
    {
        $media = DB::table('defect_media')->where('id', $id)->first();
        if (!$media) {
            return response()->json(['success' => false, 'message' => 'Not found.'], 404);
        }

        $userId = auth()->user()->id;

        // Check: is user the uploader?
        $isUploader = ($media->uploaded_by == $userId);

        // Check: is user a club admin?
        // Replace with your existing club admin check:
        $isClubAdmin = DB::table('club_user')
            ->where('club_id', $media->club_id)
            ->where('user_id', $userId)
            ->where('role', 'admin')
            ->exists();

        if (!$isUploader && !$isClubAdmin) {
            return response()->json([
                'success' => false,
                'message' => 'You do not have permission to delete this media.',
            ], 403);
        }

        // Delete files from storage
        $filePath = storage_path("app/defect_media/{$media->club_id}/{$media->stored_name}");
        $thumbPath = storage_path("app/defect_media/{$media->club_id}/thumbs/{$media->stored_name}");
        if (file_exists($filePath)) unlink($filePath);
        if (file_exists($thumbPath)) unlink($thumbPath);

        // Decrement cached count
        DB::table('plane_tech_log_sheets')
            ->where('id', $media->defect_id)
            ->where('media_count', '>', 0)
            ->decrement('media_count');

        DB::table('defect_media')->where('id', $id)->delete();

        return response()->json(['success' => true]);
    }
}
```

---

## Summary of what's needed

1. **Run the migration** — creates `defect_media` table + adds `media_count` to `plane_tech_log_sheets`
2. **Place `upload_defect_media.php`** on the API server at the web root (accessible at `https://local-api.toaviate.com/upload_defect_media.php`)
3. **Add the routes** to `routes/api.php`
4. **Create `DefectMediaController`** with the methods above
5. **Adjust the club admin check** — the `club_user` query above is a placeholder; replace with however your app checks club admin membership
