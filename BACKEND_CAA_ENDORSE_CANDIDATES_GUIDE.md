# BACKEND_CAA_ENDORSE_CANDIDATES_GUIDE.md
### Training-flight candidates need the log-sheet reference — 2 additive keys

**Audience:** the backend agent. One array in one file, additive only.

**Why.** The reval checklist's training-flight `candidates` (≥1 h dual
flights in the window) are now actionable in the frontend: an **Endorse**
button opens the logbook stamp modal (`logbook_endorsements/sign` direct
mode, FCL.740.A wording preselected) so the instructor can endorse the
flight on the spot — which is what flips the `training_flight` check green.
That call needs the club log-sheet id (`entity_id`), but the candidate
payload only carries `flight_date` / `dual_time` / `registration`.

## Copy-paste

`api/v1/models/caa_form_eligibility.model.php` — the candidate builder
(~line 249):

```php
				$dual_candidates[] = array(
					"flight_date" => $e['flight_date'],
					"dual_time"   => $e_dual,
					"registration" => isset($e['registration']) ? $e['registration'] : null,
					// Lets the frontend open the endorse-this-flight stamp
					// modal. Only 'club' lines are directly endorsable
					// (SignDirect wants a plane_log_sheets id); manual lines
					// keep the button hidden.
					"kind"        => isset($e['kind']) ? $e['kind'] : null,
					"ref_id"      => isset($e['ref_id']) ? (int)$e['ref_id'] : null,
				);
```

No endpoint or validation changes — `logbook_endorsements/sign` (direct)
already enforces instructor-of-club + line ownership.

## Acceptance criteria

1. A club dual flight in the window → its candidate row carries
   `kind: "club"` and the `plane_log_sheets` id as `ref_id`.
2. A manual logbook line candidate → `kind: "manual"` (frontend hides
   Endorse for it).
3. After the instructor endorses a candidate via
   `POST logbook_endorsements/sign` with the FCL.740.A wording, a re-run of
   the eligibility shows `training_flight.pass: true` with that flight as
   `evidence` (existing behaviour — the endorsement pattern-match already
   covers it).
