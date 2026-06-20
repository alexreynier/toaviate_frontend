# Flight Replay — Frontend Implementation Status

First pass of the per-flight replay/debrief view (see
`FRONTEND_FLIGHT_REPLAY_GUIDE.md` for the backend contract).

## What shipped

- **Route:** `dashboard.flight_replay/:flight_id` (shared, reachable from any
  section). `:flight_id` is a `plane_log_sheets.id`.
- **View:** [views/flight_replay.html](views/flight_replay.html) — snazzy gradient
  header, summary strip (with the baro/GPS altitude-source badge), Google map with
  altitude-graded route + rotating draggable aircraft marker + photo/note pins,
  animated SVG **six-pack** ([js/directives/flightSixPack.js](js/directives/flightSixPack.js)),
  **height profile** via the already-loaded Chart.js
  ([js/directives/flightHeightProfile.js](js/directives/flightHeightProfile.js)),
  transport bar (play/pause + scrubber + 4–32× speed) with rAF interpolation between
  fixes, photo filmstrip + uploader (flow.js staging), and debrief/timeline notes
  (view + add, coaching flag, instructor badge). Photo lightbox.
- **Controller:** [js/controllers/flightReplayController.js](js/controllers/flightReplayController.js)
  — single shared scrub state drives map + gauges + profile. Trusts all
  backend-derived series (no recompute). Handles `has_track:false`, `FORBIDDEN`,
  and generic errors gracefully.
- **Service:** [js/services/flightReplayService.js](js/services/flightReplayService.js)
  — all endpoints from the guide + `PhotoUrl()` (prepends the per-env API base).
- **Launch affordances** (each shown only when the row has `has_track`):
  - My Logbook — replay icon in the actions cell.
  - Aircraft journey log — action in the table row **and** the mobile card.
  - Student records — replay icon beside the existing training-detail info icon.

Fully responsive (instruments stack above the map on tablet; six-pack/summary go
2-up on phones) and heavily animated (gauge needle tweening, fades, hover lifts).

## Map provider — pluggable (MapLibre default, Google optional)

The map is **provider-agnostic**. The controller talks only to a small adapter
interface ([js/services/flightMapAdapterService.js](js/services/flightMapAdapterService.js));
switching providers is a one-line config change, not a rewrite.

- **Default: MapLibre GL** — free, **no API key**, loaded lazily from CDN
  ([js/services/mapLibreLoaderService.js](js/services/mapLibreLoaderService.js)),
  free OpenStreetMap raster tiles. Works out of the box today.
- **Optional: Google Maps** — set `map_provider: 'google'` in
  [js/services/envConfigService.js](js/services/envConfigService.js) **and** fill in
  `google_maps_key` (currently the `REPLACE_WITH_GOOGLE_MAPS_KEY` placeholder;
  restrict it by HTTP referrer). If 'google' is selected but no key is set, the
  adapter automatically falls back to MapLibre.

Config knobs (per environment): `map_provider`, `google_maps_key`,
`maplibre_style_url` (optional keyed vector style, e.g. MapTiler, else free OSM).

| | MapLibre (default) | Google Maps |
|---|---|---|
| Cost / key | Free, no key | Billable API key in client JS |
| Tiles | OSM raster (or keyed vector) | Google terrain |
| Route | 1 GeoJSON layer, data-driven colour | N polyline objects |
| Marker | HTML element, CSS rotation | SVG icon, `icon.rotation` |
| Security | No client key | Client key (the CLAUDE.md concern) |

To A/B compare: flip `map_provider` between `'maplibre'` and `'google'` and reload.

## Airspace overlay (openAIP, AIRAC-locked)

A show/hide **airspace layer** sits over the map, working on both providers via
the same adapter (`setAirspace` / `setAirspaceVisibility` / `setAirspaceCategories`
in [js/services/flightMapAdapterService.js](js/services/flightMapAdapterService.js)).

- **Lazy:** the GeoJSON is fetched only the first time the user turns the layer on
  ([FlightReplayService.GetAirspace](js/services/flightReplayService.js)), scoped to
  the flight's date + padded track bbox.
- **Date-locked:** the request sends the flight's `flight_date`; the backend
  returns the airspace **in force on that day** (AIRAC-versioned) so a flight always
  shows the airspace that applied when it was flown.
- **Class-filterable:** a legend with per-category toggles (CTR/TMA, ATZ, Danger,
  Restricted, Prohibited, Other), colour-coded; click an area for name / type /
  class / vertical limits. Shows AIRAC cycle + an "≈ nearest" badge if the backend
  had no exact dataset for the date.

**Backend dependency:** needs the `GET /api/v1/airspace?date&bbox` endpoint and the
openAIP ingestion / AIRAC-versioned storage described in
[BACKEND_ENDPOINT_SPEC_AIRSPACE.md](BACKEND_ENDPOINT_SPEC_AIRSPACE.md). Until it
exists the toggle shows a "couldn't load airspace" state; the rest of the page is
unaffected.

## Still needed to go live

1. **`has_track` on the list payloads.** The replay payload and `/meta` already
   return `has_track`, but the three *list* endpoints that feed the launch points
   don't yet. The replay buttons are wired to `row.has_track` and stay hidden until
   it's present — so they light up automatically once the backend adds the flag to:
   - the personal-logbook combined entries (`ref_id` rows),
   - the aircraft journey-log rows (`id`),
   - the student-records flight rows (`id`).
   No frontend change needed when that lands.
