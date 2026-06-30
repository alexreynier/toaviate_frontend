app.factory('TrackerHealthService', TrackerHealthService);

    // Single source of truth for Fox-tracker device health, keyed off `last_seen`
    // (a UTC "YYYY-MM-DD HH:MM:SS" string of the last raw packet, or null if the
    // device has never reported). Freshness thresholds:
    //   green/healthy  < 48h,  amber/delayed < 7 days,  red/stale older,
    //   grey/"No data" when last_seen is null/absent/unparseable.
    // Built defensively: a missing field degrades to "No data" rather than erroring,
    // so it works whether or not a given endpoint already returns last_seen.
    // Shared by the Fox Trackers list and the Aircraft Trackers (plane) views.
    function TrackerHealthService() {
        var GREEN_HOURS = 48;
        var AMBER_DAYS = 7;

        var service = {};
        service.state          = state;
        service.badgeClass     = badgeClass;
        service.label          = label;
        service.lastSeenHuman  = lastSeenHuman;
        service.tsLocal        = tsLocal;
        return service;

        function parseUtc(ts) {
            if (!ts) { return null; }
            var m = moment.utc(ts, 'YYYY-MM-DD HH:mm:ss', true);
            if (!m.isValid()) { m = moment.utc(ts); }   // lenient fallback
            return m.isValid() ? m : null;
        }

        // 'healthy' | 'warning' | 'stale' | 'none'  (accepts a tracker obj or a string)
        function state(trackerOrTs) {
            var ts = (trackerOrTs && typeof trackerOrTs === 'object') ? trackerOrTs.last_seen : trackerOrTs;
            var m = parseUtc(ts);
            if (!m) { return 'none'; }
            var hours = moment.utc().diff(m, 'hours');
            if (hours < GREEN_HOURS) { return 'healthy'; }
            if (hours < AMBER_DAYS * 24) { return 'warning'; }
            return 'stale';
        }

        function badgeClass(trackerOrTs) {
            var s = state(trackerOrTs);
            if (s === 'healthy') { return 'snazzy-table__badge--success'; }
            if (s === 'warning') { return 'snazzy-table__badge--warning'; }
            if (s === 'stale')   { return 'snazzy-table__badge--danger'; }
            return 'snazzy-table__badge--muted';
        }

        function label(trackerOrTs) {
            var s = state(trackerOrTs);
            if (s === 'healthy') { return 'Healthy'; }
            if (s === 'warning') { return 'Delayed'; }
            if (s === 'stale')   { return 'Stale'; }
            return 'No data';
        }

        // "3 hours ago" / "—" if never seen.
        function lastSeenHuman(trackerOrTs) {
            var ts = (trackerOrTs && typeof trackerOrTs === 'object') ? trackerOrTs.last_seen : trackerOrTs;
            var m = parseUtc(ts);
            return m ? m.fromNow() : '—';
        }

        // Local-time formatted timestamp, or "Never" if null.
        function tsLocal(ts) {
            if (!ts) { return 'Never'; }
            var m = parseUtc(ts);
            return m ? m.local().format('DD MMM YYYY HH:mm') : '—';
        }
    }
