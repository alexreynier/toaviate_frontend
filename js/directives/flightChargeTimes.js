// Invoice flight-times display (§5 FRONTEND_CHARGE_TYPES_AND_TIMES_GUIDE.md).
// Renders the flight window line + one charged line, branching on the API's
// flight_details.charge_basis — matching the invoice PDFs exactly.
// Usage: <flight-charge-times details="flight.flight_details"></flight-charge-times>
app.directive('flightChargeTimes', ['$filter', function($filter) {

    // Per-basis explanations — VERBATIM from recorded_times_footnote() in the
    // backend's api/v1/models/pdf.model.php. A member holding a PDF next to the
    // app must see the same words; do not edit these without changing the PDF.
    var EXPLAIN = {
        airborne_plus_allowance: 'You are charged airborne time (first takeoff to last landing) plus a taxi allowance, so your charged time may differ from your actual brakes off to brakes on. Airborne and logbook times are rounded to the nearest 5 minutes; recorded times are exact.',
        airborne_rounded: 'You are charged airborne time (first takeoff to last landing), rounded to the nearest 5 minutes. Flight and airborne times are rounded to the nearest 5 minutes; recorded times are exact.',
        brakes_rounded: 'You are charged brakes off to brakes on, rounded to the nearest 5 minutes. Recorded times are exact.',
        brakes_exact: 'You are charged your actual brakes off to brakes on time, to the minute. Flight times are shown for your logbook, rounded to the nearest 5 minutes; recorded times are exact.',
        flight_exact: 'You are charged from first takeoff to last landing, to the minute. Flight times are shown for your logbook, rounded to the nearest 5 minutes; recorded times are exact.',
        airborne_actual: 'You are charged your actual airborne time as recorded by the aircraft tracker (or first takeoff to last landing when no recording is available), to the minute. Flight times are shown for your logbook, rounded to the nearest 5 minutes; recorded times are exact.',
        tacho: "You are charged by the aircraft's tacho reading, not by clock time. Flight times are shown for your logbook, rounded to the nearest 5 minutes; recorded times are exact.",
        hobbs: "You are charged by the aircraft's hobbs reading, not by clock time. Flight times are shown for your logbook, rounded to the nearest 5 minutes; recorded times are exact.",
        _default: 'Logbook times are rounded to the nearest 5 minutes; all other times to the nearest minute.'
    };

    function rec(t) {
        if (!t || t === '00:00:00' || t === '00:00') { return null; }
        return t;
    }

    function hm(mins) {
        if (mins === null || isNaN(mins)) { return ''; }
        return Math.floor(mins / 60) + ':' + ('0' + (mins % 60)).slice(-2);
    }

    function hoursToHM(dec) {
        var h = parseFloat(dec);
        if (isNaN(h)) { return ''; }
        return hm(Math.round(h * 60));
    }

    function fmt(t) {
        return roundTimeToMinute(t); // datetime.js global
    }

    function build(d) {
        if (!d) { return null; }

        var basis = d.charge_basis;
        if (!basis) {
            // Pre-rollout payloads without charge_basis: presence of the TPC window is
            // the only safe inference; anything else gets the window with no charging claim.
            basis = d.tpc_brakes_off ? 'airborne_plus_allowance' : '';
        }

        var m = { window: null, line: null };

        var wf = rec(d.brakes_off_rounded);
        var wt = rec(d.brakes_on_rounded);
        if (wf || wt) {
            m.window = {
                label: (basis === 'airborne_plus_allowance') ? 'Logbook time:' : 'Flight Times:',
                from: wf ? fmt(wf) : '–',
                to: wt ? fmt(wt) : '–'
            };
        }

        var takeoff = rec(d.takeoff_time), landing = rec(d.landing_time);
        var takeoffR = rec(d.takeoff_rounded), landingR = rec(d.landing_rounded);
        var line = null;

        if (basis === 'airborne_plus_allowance') {
            var charged = minutesBetween(d.tpc_brakes_off, d.tpc_brakes_on);
            var airborne = minutesBetween(takeoffR, landingR);
            if (takeoffR && landingR && charged !== null && airborne !== null) {
                line = {
                    pre: 'Charged: airborne ' + fmt(takeoffR) + ' - ' + fmt(landingR) +
                         ' (' + hm(airborne) + ') + ' + (charged - airborne) + ' min taxi allowance = ',
                    bold: hm(charged)
                };
            } else if (charged !== null) {
                // arithmetic can't be computed — plain charged window only
                line = { pre: 'Charged time: ' + fmt(d.tpc_brakes_off) + ' - ' + fmt(d.tpc_brakes_on), bold: '' };
            }

        } else if (basis === 'airborne_rounded') {
            var ab = minutesBetween(takeoffR, landingR);
            if (takeoffR && landingR && ab !== null) {
                line = { pre: 'Charged: airborne ' + fmt(takeoffR) + ' - ' + fmt(landingR) + ' (' + hm(ab) + ')', bold: '' };
            }

        } else if (basis === 'brakes_rounded') {
            var br = minutesBetween(wf, wt);
            if (br !== null) {
                // the span IS the flight-times window — don't repeat the clock times
                line = { pre: 'Charged: brakes off to brakes on (' + hm(br) + ')', bold: '' };
            }

        } else if (basis === 'brakes_exact') {
            var bo = rec(d.brakes_off), bn = rec(d.brakes_on);
            var be = minutesBetween(bo, bn);
            if (bo && bn && be !== null) {
                line = { pre: 'Charged: brakes off to brakes on ' + fmt(bo) + ' - ' + fmt(bn) + ' (' + hm(be) + ')', bold: '' };
            }

        } else if (basis === 'flight_exact') {
            var fe = minutesBetween(takeoff, landing);
            if (takeoff && landing && fe !== null) {
                line = { pre: 'Charged: takeoff to landing ' + fmt(takeoff) + ' - ' + fmt(landing) + ' (' + hm(fe) + ')', bold: '' };
            }

        } else if (basis === 'airborne_actual') {
            var at = parseFloat(d.airborne_time);
            if (!isNaN(at) && at > 0) {
                line = { pre: 'Charged: airborne time as recorded (' + hoursToHM(at) + ')', bold: '' };
            } else {
                var aa = minutesBetween(takeoff, landing);
                if (takeoff && landing && aa !== null) {
                    line = { pre: 'Charged: airborne (takeoff to landing) ' + fmt(takeoff) + ' - ' + fmt(landing) + ' (' + hm(aa) + ')', bold: '' };
                }
            }

        } else if (basis === 'tacho' || basis === 'hobbs') {
            // tacho_start / tacho_end are the only field names (hobbs uses the same pair)
            var ts = parseFloat(d.tacho_start);
            var te = parseFloat(d.tacho_end);
            if (!isNaN(ts) && !isNaN(te) && te > ts) {
                line = {
                    pre: 'Charged: ' + basis + ' ' + ts.toFixed(2) + ' - ' + te.toFixed(2) + ' (' + (te - ts).toFixed(2) + ' hours)',
                    bold: ''
                };
            }
        }
        // unknown/missing basis: window only, no charging claim

        // Tooltip = the PDF footnote text: "Recorded times: <list>. <explanation>"
        var recorded = $filter('recordedTimes')(d);
        var footnote = (recorded ? 'Recorded times: ' + recorded + '. ' : '') +
                       (EXPLAIN[basis] || EXPLAIN._default);
        if (m.window) { m.window.tooltip = footnote; }
        if (line) { line.tooltip = footnote; m.line = line; }

        return (m.window || m.line) ? m : null;
    }

    return {
        restrict: 'E',
        scope: { details: '=' },
        template:
            '<span class="fct">' +
              '<span ng-if="m.window" uib-tooltip="{{ m.window.tooltip }}">{{ m.window.label }} {{ m.window.from }} - {{ m.window.to }}</span>' +
              '<br ng-if="m.window && m.line" />' +
              '<span ng-if="m.line" uib-tooltip="{{ m.line.tooltip }}">{{ m.line.pre }}<strong ng-if="m.line.bold">{{ m.line.bold }}</strong></span>' +
            '</span>',
        link: function(scope) {
            scope.$watch('details', function(d) {
                scope.m = build(d);
            });
        }
    };
}]);
