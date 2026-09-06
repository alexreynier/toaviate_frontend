# BACKEND_CAA_EVIDENCE_ICAO_TYPES_GUIDE.md
### Reval evidence panel: group by ICAO type designator, not the marketing name

**Audience:** the backend agent. Two files, additive field + one grouping
rule, no migrations.

**The bug (screenshot-verified).** The reval evidence panel's per-type rows
show registrations (G-SHBA, G-BMTJ…) and G-INFO "Popular Names" (SKYHAWK)
instead of ICAO type designators (C152, C172, PA28…). Cause:
`CaaFormEligibility::window_breakdown()` groups by the logbook entry's
`aircraft_model`, which for club flights is `planes.type_name` — the G-INFO
**PopularName** ("SKYHAWK") — falling back to registration. The authoritative
designator already exists: `planes.icao_type`
(G-INFO `ICAOAircraftTypeDesignator`, see the import at
`planes.model.php:793`) — it just never reaches the logbook entries.

**Required rule:** group by the **ICAO type designator**; use the
registration **only when no type is available**.

## Copy-paste

### 1. `api/v1/models/personal_logbook.model.php` — expose `icao_type`

Club entries SELECT (~line 92) — add `p.icao_type`:

```php
                       p.registration, p.icao_type, p.type_name, p.plane_type, p.manufacturer, p.plane_class,
```

Club entry array (~line 154, next to `aircraft_model`) — G-INFO uses the
literal string `UNDEFINED` for unknown types, treat it as unset:

```php
                "icao_type"        => ($r['icao_type'] && strtoupper(trim($r['icao_type'])) !== 'UNDEFINED') ? trim($r['icao_type']) : null,
```

Manual entry array (~line 335, next to `aircraft_model`) — the manual table
has no designator column; the pilot-typed `aircraft_type` is handled at the
grouping step instead:

```php
                "icao_type"        => null,
```

(Additive field — no other consumer of `build()` is affected.)

### 2. `api/v1/models/caa_form_eligibility.model.php` — `window_breakdown()` grouping (~line 75)

Replace the existing `$type = …aircraft_model…` block with:

```php
			// Group by the ICAO type designator (C152, C172, PA28…). Manual
			// lines have no designator column — their pilot-typed
			// aircraft_type is the next best thing. Registration ONLY when
			// no type at all; never the marketing name (SKYHAWK…).
			$type = strtoupper(trim((string)(isset($e['icao_type']) ? $e['icao_type'] : '')));
			if(($type === '' || $type === 'UNDEFINED') && isset($e['kind']) && $e['kind'] === 'manual'){
				$type = strtoupper(trim((string)(isset($e['aircraft_type']) ? $e['aircraft_type'] : '')));
			}
			if($type === '' || $type === 'UNDEFINED' || $type === '-'){
				$type = strtoupper(trim((string)(isset($e['registration']) ? $e['registration'] : '')));
			}
			if($type === '' || $type === '-'){ $type = 'Unspecified'; }
```

## Acceptance criteria

1. A club flight on a plane with `icao_type = C172`, `type_name = SKYHAWK` →
   groups under **C172** (SKYHAWK appears nowhere in `by_type`).
2. A club flight on a plane whose `icao_type` is empty or `UNDEFINED` →
   groups under its **registration**.
3. A manual logbook entry with pilot-typed `aircraft_type = "c152"` →
   groups under **C152** (case-normalised, merging with club C152 hours).
4. A manual entry with no type and no registration → **Unspecified**.
5. Flights on the same designator across different registrations merge into
   ONE `by_type` row with summed P1/PUT.
6. `PersonalLogbook::build()` output is otherwise unchanged (the new
   `icao_type` key is additive) — logbook screens, endorsements and exports
   behave identically.
