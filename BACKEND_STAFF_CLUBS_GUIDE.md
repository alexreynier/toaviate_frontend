# BACKEND_STAFF_CLUBS_GUIDE.md
### One endpoint for "clubs where this user is staff" — backend work package

> **Status: ✅ SHIPPED (2026-08-12).** Implemented verbatim in
> `clubs.model.php` / `clubs.controller.php` and documented in
> `FRONTEND_CAA_FORMS_GUIDE.md` (Misc → Club switcher). Kept for the
> acceptance criteria.

**Audience:** the backend agent. Self-contained; copy-paste ready. One new
GET endpoint on the clubs resource, no schema changes, no migrations.

**Context.** Instructor-facing frontend screens (Student Records, the new CAA
Forms hub) need "the clubs where this user works" to drive a club switcher.
The only endpoints available today are:

| Endpoint | Filter | Gap |
|---|---|---|
| `clubs/get_all_admin_for_user/{user_id}` | `members.is_manager = 1` | misses plain instructors |
| `clubs/get_all_instructor_for_user/{user_id}` | `members.instructor = 1` | misses managers, and misses a CAA Head of Training / deputy who is neither |

Student Records used the admin list alone, which **locked out every
instructor who isn't also a club manager**. The frontend now works around it
by requesting both lists and unioning them client-side — two requests, and a
HoT/deputy who is neither instructor nor manager still gets nothing.

The frontend already calls the new endpoint below (`UserService.GetStaffClubs`)
and silently falls back to the client-side union until it exists, so this can
ship whenever — nothing breaks in either order. (Until it ships, the unknown
path falls through to the clubs `get_all()` branch; the frontend detects the
shape mismatch and ignores it.)

---

## The endpoint

`GET /api/v1/clubs/get_all_staff_for_user/{user_id}`

Standard auth (same as the two existing list endpoints). Returns every club
where the user is **any** of:

- a current member with `instructor = 1`, or
- a current member with `is_manager = 1`, or
- the club's CAA Head of Training (`sms_settings.head_of_training_id`), or
- a current CAA deputy HoT (`caa_form_deputies`, `current = 1`).

Response — identical shape to the existing list endpoints:

```json
{ "success": true, "clubs": [ { ...clubs.* row... } ] }
```

---

## Copy-paste

### 1. `api/v1/models/clubs.model.php`

Add directly after `get_all_instructor_for_user(...)` (it ends around line 56):

```php
    // Clubs where the user is STAFF in any capacity: a current instructor
    // or manager membership, the club's CAA Head of Training
    // (sms_settings.head_of_training_id) or a current deputy HoT
    // (caa_form_deputies). Response shape matches the two lists above.
    // Consumed by the frontend's UserService.GetStaffClubs
    // (BACKEND_STAFF_CLUBS_GUIDE.md in the frontend repo).
    public function get_all_staff_for_user($user_id){
    	$sql = "SELECT
					clubs.*
				FROM clubs
				WHERE EXISTS (
					SELECT 1 FROM members m
					WHERE m.club_id = clubs.id AND m.user_id = ?
					AND m.current = 1 AND (m.instructor = 1 OR m.is_manager = 1))
				OR EXISTS (
					SELECT 1 FROM sms_settings s
					WHERE s.club_id = clubs.id AND s.head_of_training_id = ?)
				OR EXISTS (
					SELECT 1 FROM caa_form_deputies d
					WHERE d.club_id = clubs.id AND d.user_id = ?
					AND d.current = 1)
				ORDER BY clubs.id";
		$clubs = $this->database->standard_query($sql, array($user_id, $user_id, $user_id));

		return array("success" => true, "clubs" => $clubs);
    }
```

### 2. `api/v1/controllers/clubs.controller.php`

Add one `elseif` to the GET switch, after the `get_all_admin_for_user` branch
and **before** the numeric `$this->resource_id > 0` branch (order matters —
the numeric branch would never match this string, but keep the named routes
grouped together):

```php
				} elseif(isset($this->resource_id) && $this->resource_id == "get_all_staff_for_user"){
					return $the_model->get_all_staff_for_user($this->second_level);
```

---

## Acceptance criteria

1. A user who is a current instructor (not manager) at club A gets club A.
2. A user who is a current manager (not instructor) at club B gets club B.
3. A user who is both at club C gets club C **once** (no duplicate rows).
4. A user who is only `sms_settings.head_of_training_id` for club D gets club D.
5. A user who is only a `caa_form_deputies` row with `current = 1` for club E
   gets club E; with `current = 0` they do not.
6. A member row with `current = 0` never qualifies (ex-staff drop off).
7. A user with none of the above gets `{ "success": true, "clubs": [] }`.
8. Requires the standard auth headers like its two sibling endpoints — an
   unauthenticated call gets the usual 401.
