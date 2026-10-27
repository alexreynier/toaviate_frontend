// ─────────────────────────────────────────────────────
// Split flights to review (club managers) — dashboard.manage_club.split_review
// FRONTEND_TRACK_DATA_GUIDE.md §4.2. The list itself is the shared
// <suspect-splits> directive (js/directives/suspectSplits.js); this
// controller only supplies the admin club id, the way the flights page does.
// ─────────────────────────────────────────────────────

app.controller('SplitReviewController', SplitReviewController);

    SplitReviewController.$inject = ['$rootScope', '$scope'];
    function SplitReviewController($rootScope, $scope) {

        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user_id = vm.user.id;

        // Last write made from the list (unsplit / dismissed) — the directive
        // re-fetches itself; this is only here for a host that wants to react.
        vm.lastChange = null;
        $scope.$on('suspectSplits:changed', function(event, info) {
            vm.lastChange = info;
        });
    }
