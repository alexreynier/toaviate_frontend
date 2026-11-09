// ─────────────────────────────────────────────────────────────────────────
// <cancel-reason-fields club-id state pilot-name preset notes-id>
//
// The cancellation reason picker + the fee decision, shared by the Scheduler v2
// booking card and the v2 booking panel's Cancel popup (cancellation fees, 2026-11-05).
//   club-id     the booking's club → CancellationFeesService.Policy (reasons, fees, can_claim)
//   state       the caller's object; the directive writes
//                 { reason: label, key, notes, claim: bool, fee, currency, canClaim, feeName }
//               and the caller passes it to CancellationFeesService.CancelBooking
//   pilot-name  who the fee would be invoiced to (copy only)
//   preset      a reason key to pick on load ('no_show' from the card's No-show button)
//   notes-id    the textarea id (ToastService.highlightField for "Other - please specify")
// Staff see the staff-only reasons (Late cancellation, No-show). Someone who may claim
// gets a "Charge the fee" switch — ON by default for the staff-only reasons, OFF for the
// member-side ones; anyone else just sees that the club may charge a fee. Nothing here
// talks to the API except the policy read.
// ─────────────────────────────────────────────────────────────────────────
app.directive('cancelReasonFields', cancelReasonFields);
cancelReasonFields.$inject = ['CancellationFeesService'];
function cancelReasonFields(CancellationFeesService) {
    var seq = 0;
    return {
        restrict: 'E',
        scope: { clubId: '=', state: '=', pilotName: '=', preset: '=', notesId: '@' },
        templateUrl: 'views/directives/cancel_reason_fields.html',
        controllerAs: 'crf',
        bindToController: true,
        controller: ['$scope', function ($scope) {
            var crf = this;
            crf.uid = 'crf' + (++seq);
            crf.loading = true;
            crf.policy = { reasons: CancellationFeesService.fallbackReasons(), can_claim: false, currency: 'GBP' };
            crf.reasons = crf.policy.reasons;
            crf.anyFees = false;
            crf.picked = null;

            if (!crf.state) { crf.state = {}; }
            crf.state.notes = crf.state.notes || '';

            crf.money = function (n) { return CancellationFeesService.money(n, crf.policy.currency); };
            crf.reasonText = CancellationFeesService.reasonText;   // shown words; the stored label stays r.label
            crf.feeName = function () { return CancellationFeesService.feeName(crf.picked && crf.picked.key); };

            crf.pick = function (r) {
                crf.picked = r;
                crf.state.reason = r.label;
                crf.state.key = r.key;
                crf.state.fee = parseFloat(r.fee) || 0;
                crf.state.currency = crf.policy.currency;
                crf.state.canClaim = !!crf.policy.can_claim;
                crf.state.feeName = CancellationFeesService.feeName(r.key);
                // staff-only reasons (no-show / late cancellation) are why the fee exists → on by default;
                // an unwell / unavailable pilot is charged only when staff choose to
                crf.state.claim = crf.state.canClaim && crf.state.fee > 0 && !!r.staff_only;
            };
            crf.isOther = function () { return crf.picked && crf.picked.key === 'other'; };

            function apply(policy) {
                crf.loading = false;
                if (policy && policy.success && angular.isArray(policy.reasons)) {
                    crf.policy = policy;
                    crf.reasons = policy.reasons;
                    crf.anyFees = policy.reasons.some(function (r) { return parseFloat(r.fee) > 0; });
                }
                var want = (crf.state && crf.state.key) || crf.preset;
                var hit = null;
                crf.reasons.forEach(function (r) { if (r.key === want) { hit = r; } });
                if (hit) { crf.pick(hit); }
                else if (crf.state.reason) {
                    crf.reasons.forEach(function (r) { if (r.label === crf.state.reason) { hit = r; } });
                    if (hit) { crf.pick(hit); }
                }
            }
            function load() {
                var id = parseInt(crf.clubId, 10) || 0;
                if (!id) { apply(null); return; }
                CancellationFeesService.Policy(id).then(apply);
            }
            load();
            $scope.$watch(function () { return crf.clubId; }, function (n, o) { if (n !== o) { load(); } });
            // "Other - please specify" flags the notes (ToastService.highlightField) — clear it once there is a note
            $scope.$watch(function () { return crf.state && crf.state.notes; }, function (v) {
                if (!v || !String(v).trim()) { return; }
                var el = document.getElementById(crf.notesId || (crf.uid + '-notes'));
                if (el) { el.classList.remove('field-error-highlight'); }
            });
            $scope.$watch(function () { return crf.preset; }, function (n, o) {
                if (n === o || !n) { return; }
                crf.reasons.forEach(function (r) { if (r.key === n) { crf.pick(r); } });
            });
        }]
    };
}
