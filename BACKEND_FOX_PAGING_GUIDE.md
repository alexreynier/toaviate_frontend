# Backend: paging for unclaimed Fox flights (claim_a_flight)

The "Claim a flight" page shows the newest 10 Fox entries per aircraft and had no
way to reach older ones. The frontend now has a **Load more unclaimed flights**
button under each aircraft. It works against the current API (it just can't get
further than the first page), and becomes fully functional with the three small
backend changes below.

## Contract the frontend expects

`GET /api/v1/fox/plane/{plane_id}?offset=N&limit=M` (unclaimed only)

```json
{
  "success": true,
  "fox_entries": [ ...cleaned entries as today... ],
  "total": 27,          // unclaimed, non-duplicated entries for this aircraft
  "has_more": true,     // offset + raw rows fetched < total
  "next_offset": 20     // pass back as ?offset= for the next page
}
```

`GET /api/v1/fox/user/{user_id}` — each aircraft additionally carries
`total_unclaimed`, `has_more`, `next_offset` (same meaning).

`next_offset` is in **raw `fox_entries` row space**, not cleaned-row space: the
cleaner drops entries that have no `plane_log_sheet`, so a page of 10 can render
as 8. Paging by the number of rows displayed would skip flights.

## Patch

### 1. `api/v1/controllers/fox.controller.php` — read the paging params

```php
} elseif(isset($this->resource_id) && $this->resource_id == "plane"){
    $limit  = isset($_GET['limit'])  ? max(1, min(100, intval($_GET['limit']))) : 10;
    $offset = isset($_GET['offset']) ? max(0, intval($_GET['offset'])) : 0;
    return $resource->get_fox_logs_by_plane($this->second_level, 0, $limit, $offset);
```

### 2. `api/v1/models/fox.model.php` — `get_fox_logs_by_plane`

Signature and the LIMIT clause:

```php
public function get_fox_logs_by_plane($plane_id, $claimed = 0, $limit = 10, $offset = 0){
    ...
    if($limit > 0){
        $query2 = $query2 . " LIMIT ".intval($limit)." OFFSET ".intval($offset);
    }
    $get_fox_entries = $this->database->standard_query($query2, array($get_fox["imei"], $claimed, 0));

    // Total for the paging UI (same WHERE as the page query, no LIMIT)
    $count_sql = "SELECT COUNT(*) as total FROM fox_entries
                  WHERE fox_entries.imei = ? AND ".$claim_bit." AND fox_entries.duplicated = ?";
    $total = intval($this->database->standard_query($count_sql, array($get_fox["imei"], $claimed, 0))[0]["total"]);
    $next_offset = $offset + count($get_fox_entries);
```

and the return:

```php
    return array(
        "success"     => true,
        "fox_entries" => $cleaned_flights,
        "total"       => $total,
        "has_more"    => ($limit > 0) && ($next_offset < $total),
        "next_offset" => $next_offset,
        "message"     => $claimed_or
    );
```

### 3. `api/v1/models/fox.model.php` — `get_fox_logs_by_user`

Keep the whole result, not just the entries:

```php
foreach($aeroplanes as $aeroplane){
    $page = $this->get_fox_logs_by_plane($aeroplane["plane_id"], 0, 10, 0);
    $aeroplane["flights"]         = $page["fox_entries"];
    $aeroplane["total_unclaimed"] = $page["total"];
    $aeroplane["has_more"]        = $page["has_more"];
    $aeroplane["next_offset"]     = $page["next_offset"];
    array_push($aeroplane_flights, $aeroplane);
}
```

## Frontend behaviour (already shipped)

- Button shows when `has_more` is true (or, on the old API, when the first page
  looks full). Label includes "(N more)" when `total_unclaimed` is known.
- Each click fetches 20 more with `offset=next_offset`, appends them (de-duplicated
  by entry id) and refreshes the "All flights" view.
- Against the old API the click returns the same 10; nothing new is added, the
  button hides and a toast says the server can't return more yet.
