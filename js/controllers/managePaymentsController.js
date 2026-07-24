 app.controller('ManagePaymentsController', ManagePaymentsController);

    ManagePaymentsController.$inject = ['MemberService', '$rootScope', '$location', '$scope', '$state', '$stateParams', 'PaymentService', 'ToastService'];
    function ManagePaymentsController(MemberService, $rootScope, $location, $scope, $state, $stateParams, PaymentService, ToastService) {

        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        // Cards are held per club (each club has its own Stripe account and its
        // own Stripe customer for the member), so the page is club-scoped.
        vm.clubs = [];
        vm.selected_club = null;
        vm.clubs_loading = true;

        vm.cards = [];
        vm.default_card = null;
        vm.cards_loading = false;
        vm.cards_error = "";

        vm.card_pending_delete = null;
        vm.setting_default = false;

        //FontAwesome brand icon for a Stripe card brand
        vm.card_icon = function(brand){
            switch((brand || '').toLowerCase()){
                case 'visa': return 'fab fa-cc-visa';
                case 'mastercard': return 'fab fa-cc-mastercard';
                case 'amex':
                case 'american express': return 'fab fa-cc-amex';
                case 'discover': return 'fab fa-cc-discover';
                case 'diners':
                case 'diners club': return 'fab fa-cc-diners-club';
                case 'jcb': return 'fab fa-cc-jcb';
                default: return 'far fa-credit-card';
            }
        }

        vm.select_club = function(club){
            if(vm.selected_club && club.club_id == vm.selected_club.club_id){ return; }
            vm.selected_club = club;
            vm.card_pending_delete = null;
            load_cards();
        }

        vm.make_default = function(card){
            if(vm.setting_default || card.stripe_id == vm.default_card){ return; }
            vm.setting_default = true;
            var send = { user_id: vm.user_id, club_id: vm.selected_club.club_id, card_id: card.stripe_id };
            PaymentService.UpdateDefaultCard(send)
            .then(function (data) {
                vm.setting_default = false;
                if(data.success){
                    vm.cards = data.cards || vm.cards;
                    vm.default_card = data.default_card;
                    ToastService.success('Default Card Updated', 'The card ending ' + card.last4 + ' is now your default card.');
                } else {
                    ToastService.error('Update Failed', 'We could not update your default card - please try again.');
                }
            });
        }

        // Two-step inline confirm (same pattern as the memberships page) - no
        // browser prompt/confirm dialogs.
        vm.request_delete = function(card){
            vm.card_pending_delete = card.stripe_id;
        }

        vm.cancel_delete = function(){
            vm.card_pending_delete = null;
        }

        vm.confirm_delete = function(card){
            var send = { user_id: vm.user_id, club_id: vm.selected_club.club_id, card_id: card.stripe_id };
            PaymentService.DeleteMemberCard(send)
            .then(function (data) {
                vm.card_pending_delete = null;
                if(data.success){
                    ToastService.success('Card Removed', 'The card ending ' + card.last4 + ' has been removed.');
                    load_cards();
                } else {
                    ToastService.error('Removal Failed', 'We could not remove that card - please try again.');
                }
            });
        }

        function load_cards(){
            vm.cards = [];
            vm.default_card = null;
            vm.cards_error = "";
            if(!vm.selected_club){ return; }
            vm.cards_loading = true;
            var send = { user_id: vm.user_id, club_id: vm.selected_club.club_id };
            PaymentService.GetMemberCards(send)
            .then(function (data) {
                vm.cards_loading = false;
                if(data.success){
                    vm.cards = data.cards || [];
                    vm.default_card = data.default_card;
                } else {
                    vm.cards_error = "We couldn't load your saved cards for this club - please try again shortly.";
                }
            });
        }

        function load_clubs(){
            MemberService.GetUserMemberships(vm.user_id)
            .then(function (data) {
                vm.clubs_loading = false;
                if(!data.success){
                    vm.cards_error = "We couldn't load your clubs - please try again shortly.";
                    return;
                }

                //one entry per club (a member can hold several memberships in one club)
                var seen = {};
                var clubs = [];
                (data.memberships || []).forEach(function(m){
                    if(m.club_id && !seen[m.club_id]){
                        seen[m.club_id] = true;
                        clubs.push({ club_id: m.club_id, club_name: m.club_name });
                    }
                });
                vm.clubs = clubs;

                if(clubs.length == 0){ return; }

                var preselected = clubs[0];
                if($stateParams.club_id){
                    for(var i = 0; i < clubs.length; i++){
                        if(clubs[i].club_id == $stateParams.club_id){ preselected = clubs[i]; break; }
                    }
                }
                vm.select_club(preselected);
            });
        }

        // When a redirect-based card setup (e.g. 3DS bank page) bounces back here,
        // Stripe appends setup_intent + redirect_status to the return_url. Finalise
        // it server-side (sets the card as default + links the Stripe customer).
        function handle_setup_return(){
            var setup_intent = $stateParams.setup_intent;
            var redirect_status = $stateParams.redirect_status;
            if(!setup_intent){ return; }

            //clean the Stripe params off the URL without adding a history entry
            $location.search('setup_intent', null).search('setup_intent_client_secret', null).search('redirect_status', null).replace();

            if(redirect_status === 'succeeded'){
                var send = {
                    setup_intent_id: setup_intent,
                    user_id: vm.user_id,
                    club_id: parseInt($stateParams.club_id, 10) || 0
                };
                PaymentService.ConfirmSetup(send)
                .then(function (data) {
                    if(data.success){
                        ToastService.success('Card Added', 'Your new card has been saved.');
                    }
                    load_cards();
                });
            } else {
                ToastService.error('Card Not Added', 'The card setup was not completed - please try again.');
            }
        }

        load_clubs();
        handle_setup_return();

    }
