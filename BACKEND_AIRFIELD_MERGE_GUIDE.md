# Backend Guide — Airfield review: merge a candidate into the existing record

**Status:** Frontend built and shipped against a client-side composition of
existing endpoints. This document specifies the two backend changes that would
make it correct and atomic.
**Audience:** Backend team. Companion to
[BACKEND_AIRFIELD_IMPORT_GUIDE.md](BACKEND_AIRFIELD_IMPORT_GUIDE.md).

---

## Why

`airfield_import/review` surfaces `location_dup` items — an OurAirports
candidate withheld because it sits within 1.5 km of a row we already have. The
only two outcomes today are:

- **approve** → insert the candidate as a *new* airfield (a duplicate), or
- **dismiss** → throw the candidate away.

Neither is usually the right answer, because **our existing rows are mostly
stubs**. Measured on the live local DB (27,367 airfields):

| Column         | Rows missing it | %       |
| -------------- | --------------- | ------- |
| `af_type`      | 25,593          | **94%** |
| `municipality` | 25,792          | **94%** |
| `elevation`    | 17,845          | **65%** |
| `country_code` | 16,541          | **60%** |

So in the common case the withheld candidate is the *richer* record, and the
valuable action is to **back-fill the existing row from it** — keeping the
existing `id` so every `flights` / `bookings` row that references the airfield
stays intact.

The frontend now offers that as the primary action ("Same place — update
EGKK (5 fields)"), with a per-field picker: gaps are pre-ticked, conflicting
fields must be opted into.

---

## Change 1 — return the full existing row in the review payload

`GET airfield_import/review` currently joins only the title and code of the
nearest airfield ([airfield_import.model.php:507](…)):

```sql
SELECT rq.*, na.title AS nearest_title, na.code AS nearest_code, …
```

That's not enough to compare against — the UI can't tell whether the existing
row is missing an elevation without seeing it. **Please add the whole row**,
nested, alongside the existing flat fields (keep those for compatibility):

```jsonc
{
  "id": "4",
  "reason": "location_dup",
  "distance_km": "0.42",
  "nearest_airfield_id": "9123",
  "nearest_code":  "CA-0015",       // keep
  "nearest_title": "Maxville",      // keep
  "nearest_airfield": {             // ← ADD: SELECT * of the existing row
    "id": "9123",
    "title": "Maxville",
    "code": "CA-0015",
    "wgs_n": "45.2801",
    "wgs_e": "-74.8502",
    "country": null,
    "country_code": null,
    "af_type": null,
    "elevation": null,
    "municipality": null,
    "iata_code": null,
    "active": "1",
    "source": null
  },
  "payload_decoded": { … the candidate, as today … }
}
```

**Until this lands**, the frontend fetches each one separately via
`GET airfields/{nearest_airfield_id}` — one extra round-trip per pending card.
It works, but it's N+1 and it's why this is worth doing.

---

## Change 2 — an atomic merge endpoint

```
POST airfield_import/review/{id}/merge
```

```jsonc
// request — ONLY the fields the admin ticked
{
  "fields": {
    "af_type":      "small_airport",
    "country_code": "CA",
    "country":      "Canada",
    "municipality": "Maxville",
    "elevation":    "285"
  }
}

// response
{ "success": true, "airfield_id": 9123, "updated": 5 }
```

Behaviour:

1. Load review item `{id}`; 404 if missing, reject if `status != 'pending'`.
2. **`UPDATE airfields SET … WHERE id = <nearest_airfield_id>`** — apply only
   the whitelisted keys present in `fields`. **Do not insert a new row**, and
   **do not change the `id`** — preserving it is the whole point.
3. Mark the review item resolved (a new `status = 'merged'` would be ideal, so
   the history tab can distinguish it from `dismissed`; if you'd rather not add
   an enum value, `dismissed` is acceptable).
4. Set `source_ref` / `source` on the merged row if useful for provenance, and
   consider clearing `to_be_verified`.

**Whitelist** — accept only these keys, ignore anything else in `fields`:

```
title, code, iata_code, af_type, country, country_code,
municipality, elevation, wgs_n, wgs_e
```

Explicitly **not** mergeable (ours, derived, or club-specific — an OurAirports
row must never clobber them): `id`, `source`, `source_ref`, `to_be_verified`,
`update_at`, `timezone`, `metar_station_*`, `afh_ppr`, `ppr_email`, `afh_id`,
`classification`, `active`.

Guard: if `code` is being changed, re-check uniqueness and reject with a message
naming the conflicting row, exactly as `POST airfield_import/airfield` does.

---

## What the frontend does in the meantime

`AirfieldAdminService.MergeIntoExisting()` composes the merge from endpoints
that already exist:

1. `GET  airfields/{nearest_airfield_id}` — fetch the existing record (per card)
2. `PUT  airfield_import/airfield/{id}` — write the ticked fields onto it
3. `POST airfield_import/review/{id}/dismiss` — settle the queue item *without*
   inserting a duplicate

This is correct in the happy path but **not atomic**: if step 3 fails after step
2 succeeds, the data lands but the item stays queued. The UI reports that
honestly ("Merged, but still queued") rather than claiming success. Change 2
collapses all three into one transaction and removes that failure mode.

Once both changes ship, the frontend switches to the single `merge` call and
drops the per-card `GET airfields/{id}`.
