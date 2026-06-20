// ─────────────────────────────────────────────────────
// flightSixPack — the six classic flight instruments (plus extra readouts)
// driven by the currently-scrubbed track point of a flight replay.
//
//   <flight-six-pack point="vm.currentPoint" phase="vm.currentPoint.phase">
//
// `point` is one element of the replay `track[]` array (see
// FRONTEND_FLIGHT_REPLAY_GUIDE.md §2.2). All series are backend-derived — this
// directive only renders. Needles are SVG with CSS transitions so values tween
// smoothly between fixes (the controller can also rAF-interpolate `point`).
//
// Gauges: ASI (GS), Attitude (est.), Altimeter, Heading (DI), Turn coordinator,
// VSI. Below: G, OAT, satellites, phase.
// ─────────────────────────────────────────────────────
app.directive('flightSixPack', ['$sce', function ($sce) {
    return {
        restrict: 'E',
        scope: { point: '=' },
        templateUrl: 'js/directives/flightSixPack.html',
        link: function (scope) {

            // ── Helpers exposed to the template ──
            scope.num = function (v, dp) {
                if (v === null || v === undefined || isNaN(v)) return '–';
                return Number(v).toFixed(dp == null ? 0 : dp);
            };

            // ASI: map ground speed (kt) to a needle angle. Dial spans 0..160kt
            // over 270° (−135° at 0, +135° at full scale), clamped.
            scope.asiAngle = function () {
                var kt = (scope.point && scope.point.speed_kt) || 0;
                var frac = Math.max(0, Math.min(1, kt / 160));
                return -135 + frac * 270;
            };

            // Altimeter: hundreds-foot needle (one sweep per 1000 ft).
            scope.altHundredsAngle = function () {
                var ft = (scope.point && altFt()) || 0;
                return (ft % 1000) / 1000 * 360;
            };
            // thousands-foot needle (one sweep per 10 000 ft).
            scope.altThousandsAngle = function () {
                var ft = (scope.point && altFt()) || 0;
                return (ft % 10000) / 10000 * 360;
            };

            function altFt() {
                if (!scope.point) return 0;
                // Use the backend's recommended altitude (baro when good, else GPS).
                var v = scope.point.alt_recommended_ft;
                if (v === null || v === undefined) v = scope.point.alt_ft;
                return v || 0;
            }
            scope.altFt = altFt;

            // Heading indicator: rotate the compass card so current heading is up.
            scope.diCardAngle = function () {
                return -((scope.point && scope.point.heading) || 0);
            };

            // Attitude indicator.
            // Bank: the attitude sphere rotates OPPOSITE the aircraft's roll (the
            // aircraft symbol is fixed; the world tilts the other way). A right
            // bank (+deg) must make the sphere rotate counter-clockwise so the
            // ground rises on the right as the pilot sees it — i.e. a NEGATIVE
            // SVG angle (SVG rotate is clockwise-positive). So negate.
            scope.aiRoll = function () { return -((scope.point && scope.point.bank_est_deg) || 0); };
            // Pitch: shift the horizon DOWN for nose-up (more sky shown).
            // ~1.4 px per degree, clamped so the horizon stays within the dial.
            scope.aiPitchShift = function () {
                var p = (scope.point && scope.point.pitch_est_deg) || 0;
                return Math.max(-34, Math.min(34, p * 1.4));
            };

            // Turn coordinator: standard rate (3°/s) puts the wing on the index.
            // Map turn rate to a bank-style angle, clamped to ±20° on the dial.
            scope.tcAngle = function () {
                var dps = (scope.point && scope.point.turn_rate_dps) || 0;
                var a = (dps / 3) * 15;   // 3°/s → 15° tilt
                return Math.max(-25, Math.min(25, a));
            };

            // VSI: needle rests pointing LEFT (9 o'clock = 0 fpm), ±2000 fpm over
            // ±150°. The needle points left, so rotating it CLOCKWISE (positive
            // SVG angle) swings the tip UP toward the "UP" mark. Climb (positive
            // fpm) → positive angle; descent → negative (needle swings down).
            scope.vsiAngle = function () {
                var fpm = (scope.point && scope.point.vspeed_fpm) || 0;
                var frac = Math.max(-1, Math.min(1, fpm / 2000));
                return frac * 150;
            };

            // Phase pill class
            scope.phaseClass = function () {
                var p = (scope.point && scope.point.phase) || 'parked';
                return 'fr-phase--' + p;
            };
        }
    };
}]);
