# Backend Endpoint Spec — Airspace Overlay (openAIP, AIRAC-versioned)

**Status:** Frontend implemented (layer + toggle + legend); backend endpoint &
ingestion required.
**Audience:** Backend team.
**Date:** 2026-06-17

> ⚠️ **LICENSING — READ FIRST.** openAIP's free data licence is **CC BY-NC-SA**
> (Attribution · **NonCommercial** · ShareAlike). We are proceeding under the
> **free licence** on the basis that ToAviate is **provided free of charge with no
> revenue** (so the use is non-commercial). That brings **obligations we must
> honour**: (1) **Attribution** — credit openAIP wherever airspace is shown (the
> UI does); (2) **ShareAlike** — any modified/derived *airspace data* we
> redistribute must stay under CC BY-NC-SA (so don't re-publish it under different
> terms; serving it inside our own free app is fine); (3) keep it non-commercial.
> Also: openAIP data is **not certified** and **must not be used for navigation /
> flight planning** — the overlay is debrief/reference only (the UI says so).
> See §8. If ToAviate ever monetises, the free licence stops applying and a
> **commercial licence** (licensing@openaip.net) is required — the store is
> `source`-tagged so a provider swap needs no frontend change.

The flight-replay map can show/hide an **airspace overlay** (controlled +
special-use airspace) drawn over the route. The data comes from **openAIP** and
must be **versioned by effective (AIRAC) date** so that a flight always shows the
airspace that was actually in force on the day it was flown — even when reviewed
years later. The frontend fetches airspace **lazily** (only when the user first
turns the layer on) from a dedicated endpoint, scoped to the flight's date and a
bounding box.

---

## 1. The endpoint the frontend calls

```
GET /api/v1/airspace?date=YYYY-MM-DD&bbox=minLon,minLat,maxLon,maxLat
```

- **`date`** (required) — the flight date. Return the airspace version **in force
  on that date** (see §3, AIRAC locking). Format `YYYY-MM-DD`.
- **`bbox`** (required) — `minLon,minLat,maxLon,maxLat` (WGS84 decimal degrees).
  Return only airspace volumes intersecting this box. The frontend sends the
  flight's track bounds padded by ~0.2°.
- Authenticated (standard Api-Key + session interceptor; same as every other
  endpoint). Airspace isn't club-private, but keep it behind auth like the rest.

### Response — a GeoJSON FeatureCollection

```jsonc
{
  "success": true,
  "airac": "2602",                       // the cycle actually served
  "effective_date": "2026-02-20",        // when that cycle came into force
  "next_change_date": "2026-04-17",      // when it stops being current (or null)
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {                       // Polygon or MultiPolygon, lon/lat, WGS84
        "type": "Polygon",
        "coordinates": [[ [ -0.61, 51.62 ], [ -0.42, 51.62 ], ... ]]
      },
      "properties": {
        "id": "openaip:6123abc...",       // stable openAIP id (for dedup/debug)
        "name": "LONDON TMA",
        "category": "controlled",         // see §2 — the FRONTEND filters on this
        "type": "TMA",                    // raw openAIP type (CTR/TMA/CTA/ATZ/D/R/P/…)
        "icao_class": "A",                // A–G, or null
        "lower_ft": 2500,                 // lower limit, FEET (see §4 for conversion)
        "lower_ref": "MSL",               // MSL | AGL | STD(FL) | GND | UNL
        "upper_ft": 19500,
        "upper_ref": "STD",
        "lower_label": "2500 ft",         // human label as it should be displayed
        "upper_label": "FL195",
        "country": "GB"
      }
    }
    // … one per airspace volume intersecting the bbox
  ]
}
```

**Notes**
- Geometry must be **valid GeoJSON, lon/lat order**, WGS84. Split antimeridian
  crossings if any (rare for GB/EU).
- Keep `properties` flat and small — the frontend styles/filters straight off
  them. Don't send vendor blobs.
- If there are no features in the box, return `success:true` with an empty
  `features:[]` (not a 404), plus the `airac`/`effective_date` that *would* apply.
- Suggested cache header: `Cache-Control: private, max-age=86400` — a given
  (date, bbox) is immutable once the AIRAC cycle is historical.

---

## 2. `category` — the field the frontend filters & colours on

openAIP has many granular types; the frontend groups them into **5 categories**
for the legend's per-category toggles. **You** do this mapping server-side and put
the result in `properties.category`, keeping the raw `type` alongside:

| `category`     | Includes (openAIP type)                                   | Frontend colour |
|----------------|------------------------------------------------------------|-----------------|
| `controlled`   | CTR, TMA, CTA, TMZ, control areas (classes A–E)           | blue            |
| `atz`          | ATZ, aerodrome traffic zones, RMZ                          | green           |
| `danger`       | D (danger areas)                                            | amber           |
| `restricted`   | R (restricted areas)                                        | red             |
| `prohibited`   | P (prohibited areas)                                        | dark red        |
| `other`        | anything not mapped above (gliding, wave, MATZ, etc.)      | grey            |

If a type genuinely doesn't fit, use `other` (the frontend shows it under an
"Other" legend toggle). Don't invent new category strings — these six are what
the UI knows.

---

## 3. AIRAC / date locking — the important part

Airspace changes on the **28-day AIRAC cycle**. We must be able to render a
flight's airspace **as it was on the flight date**, permanently.

### Storage model (recommended)

Store **each ingested cycle as an immutable version**, never overwrite:

```
airspace_dataset
  id
  source            'openaip'
  airac_cycle       e.g. '2602'              (YYNN)
  effective_date    DATE   when this cycle becomes current   (e.g. 2026-02-20)
  expires_date      DATE   day before the next cycle's effective_date (nullable for the newest)
  region            'GB' / 'EU' / …          (whatever you ingest)
  imported_at       TIMESTAMP
  feature_count     INT
  status            'active' | 'superseded'

airspace_volume
  id
  dataset_id        FK → airspace_dataset.id
  openaip_id        stable source id
  name
  category          mapped per §2
  type, icao_class
  lower_ft, lower_ref, upper_ft, upper_ref, lower_label, upper_label
  country
  geom              POLYGON/MULTIPOLYGON (PostGIS geometry, SRID 4326)   ← spatial index
  bbox              optional cached envelope for fast pre-filter
```

- **Resolve `date` → dataset:** pick the `airspace_dataset` where
  `effective_date <= :date AND (expires_date IS NULL OR :date <= expires_date)`
  for the relevant region. That's the version in force on the flight day.
- If `:date` predates your earliest import, fall back to the **oldest** dataset
  and set a response field `approximate:true` (frontend can note "nearest
  available airspace"). Likewise clamp a future date to the newest.
- **Never delete** old datasets — that's what makes historical flights correct.
- Spatial query: `geom && ST_MakeEnvelope(minLon,minLat,maxLon,maxLat,4326)`
  (bbox `&&`), optionally refined with `ST_Intersects`. Index `geom` (GiST).

### Why not snapshot per flight?

We considered freezing the airspace onto each flight row. The versioned-dataset
approach is better: no per-flight duplication, old flights can be back-filled
correctly, and one cycle import serves every flight in that period. The frontend
already passes the flight `date`, so it's just a lookup.

---

## 4. Ingestion from openAIP (periodic job)

Build a scheduled importer (e.g. cron, run a few days **before** each AIRAC
effective date, then again on the day to confirm):

1. **Fetch** the latest airspace from openAIP for the region(s) you cover. openAIP
   offers an API and downloadable datasets — prefer their GeoJSON; if you only
   get their native format, convert to GeoJSON on import. (Used under the free
   CC BY-NC-SA licence — see §8.) The frontend shows the attribution openAIP
   suggests, "Data used comes from openAIP", in the legend.
2. **Determine the AIRAC cycle + effective_date** for the dataset (openAIP exposes
   this; or compute from the AIRAC calendar — cycles are every 28 days from a
   known epoch).
3. **Insert a new `airspace_dataset`** (idempotent on `(source, airac_cycle,
   region)` — re-running the same cycle must not duplicate). Set the **previous**
   dataset's `expires_date = new.effective_date - 1 day` and `status='superseded'`.
4. **Normalise each volume:** map `type → category` (§2), convert vertical limits
   to **feet** with an explicit `*_ref` (MSL/AGL/STD/GND/UNL), build the human
   `*_label` (e.g. `FL195`, `2500 ft`, `SFC`, `UNL`), validate/clean geometry
   (`ST_MakeValid`), store SRID 4326.
5. **Log** counts and any volumes that failed to map (so the `other` bucket
   doesn't silently swallow new types).

Frequency: **every AIRAC cycle (28 days)** is sufficient; airspace rarely changes
off-cycle. A weekly safety re-check is fine.

---

## 5. Vertical limits — keep it simple but explicit

The frontend currently shows `lower_label` / `upper_label` verbatim in tooltips,
and may later filter by altitude band. So:

- Always provide **both** a numeric `*_ft` (best-effort feet) **and** a `*_ref`
  and a ready-made `*_label`.
- Flight levels → feet using standard atmosphere for the numeric (`FL195` →
  `19500`), but keep `upper_ref:"STD"` and `upper_label:"FL195"` so we display the
  FL, not the feet.
- `GND`/`SFC` → `lower_ft:0, lower_ref:"GND", lower_label:"SFC"`. `UNL` →
  `upper_label:"UNL"`.

---

## 6. Errors & edge cases

- Bad/missing `date` or `bbox` → `400 { success:false, message }`.
- No dataset covering the date → serve nearest with `approximate:true` (don't 404).
- Empty bbox result → `success:true, features:[]`.
- Auth failure → `401` (interceptor redirects to `/login`).

---

## 7. What the frontend does with this (FYI)

- Calls the endpoint **once**, the first time the user toggles the airspace layer
  on for a flight (lazy). Caches the result for that flight in memory.
- Draws fills + outlines, **colours by `properties.category`**, and offers
  per-category show/hide toggles + a legend, plus a tooltip/popup with `name`,
  `type`/`icao_class`, and `lower_label`–`upper_label`.
- Passes `date` = the flight's date and `bbox` = padded track bounds, so what's
  drawn is locked to the flight's day via your AIRAC lookup.

---

## 8. Licensing & legal

openAIP data is owned by **Butterfly Avionics GmbH** and published under the free
**CC BY-NC-SA** licence (full text: creativecommons.org/licenses/by-nc-sa/3.0/):

- **BY (Attribution)** — clearly credit openAIP. Suggested text:
  *"Data used comes from openAIP."* (link to openAIP.net).
- **NC (NonCommercial)** — the data may not be used for commercial purposes.
- **SA (ShareAlike)** — modified/derived data redistributed must carry the same
  licence.

**Our position.** ToAviate is **provided free of charge to clubs with no revenue**
(no paid tiers, no ads, nothing monetised), so we treat this as **non-commercial
use covered by the free licence**. What we must do to stay compliant:

- **Attribution** — show the openAIP credit wherever airspace is displayed. ✅
  Done: the legend shows "Data used comes from openAIP" linking to openAIP.net.
- **ShareAlike** — don't re-publish openAIP airspace (or a modified version of it)
  under different terms. Serving it inside our own free app is fine; **do not**
  expose a bulk "download our airspace dataset" feature under a different/again
  licence, and **don't sell or sub-licence** it. Keep the `source:'openaip'` tag
  so its provenance is traceable.
- **NonCommercial** — keep the product non-commercial. ⚠️ **If ToAviate ever
  introduces paid tiers, ads, or any monetisation, the free licence no longer
  applies** and you must obtain a **commercial licence** (licensing@openaip.net,
  which removes NC + SA for "minimal attribution"). Treat that as the trigger.

**Worth doing (low-effort safety):** a short email to openAIP describing the
setup (free-to-clubs, no revenue, airspace shown for debrief only) to get their OK
in writing. The CC "NonCommercial" test looks at the *purpose/context* of use, not
just whether end-users pay, so written confirmation removes any ambiguity. Not a
blocker for building, but cheap insurance before a wide rollout.

**Safety disclaimer (required, already shown in the UI).** openAIP data is **not
certified** and **must not be used for navigation or flight planning**; it may
contain errors. The frontend shows *"Reference / debrief only — not for navigation
or flight planning"* on the airspace panel. Keep this wherever airspace is drawn.

**Provider independence.** The store is `source`-tagged and the API/contract above
are generic GeoJSON — if licence circumstances change, an alternative source
(national AIP open data, Eurocontrol, etc.) can be ingested into the same schema
with **no frontend change**.
