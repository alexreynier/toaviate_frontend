 app.controller('ManagePaymentsAddController', ManagePaymentsAddController);

    ManagePaymentsAddController.$inject = ['MemberService', '$rootScope', '$scope', '$state', '$stateParams', '$timeout', 'PaymentService', 'ToastService'];
    function ManagePaymentsAddController(MemberService, $rootScope, $scope, $state, $stateParams, $timeout, PaymentService, ToastService) {

        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        // Cards are saved against a per-club Stripe customer, so a club must be
        // chosen before the card form can mount. When the user only belongs to
        // one club (or arrived with ?club_id from the list page) it auto-starts.
        vm.clubs = [];
        vm.clubs_loading = true;
        vm.selected_club = null;

        vm.setup_loading = false;   //creating the SetupIntent / mounting Elements
        vm.card_ready = false;      //Payment Element is mounted
        vm.submitting = false;
        vm.setup_error = "";

        var stripe = null;
        var elements = null;
        var paymentElement = null;

        vm.select_club = function(club){
            if(vm.setup_loading || vm.submitting){ return; }
            if(vm.selected_club && club.club_id == vm.selected_club.club_id){ return; }
            vm.selected_club = club;
            start_setup();
        }

        vm.cancel = function(){
            $state.go('dashboard.my_account.payment_methods', vm.selected_club ? { club_id: vm.selected_club.club_id } : {});
        }

        //ng-submit on the card form
        vm.submit_card = function(){
            if(!vm.card_ready || vm.submitting || !stripe || !elements){ return; }
            vm.submitting = true;
            vm.setup_error = "";

            stripe.confirmSetup({
                elements: elements,
                confirmParams: {
                    // Only used if the card requires a redirect (e.g. some 3DS
                    // flows) - the list page finalises the setup on return.
                    return_url: return_url()
                },
                redirect: 'if_required'
            }).then(function(result){
                //Stripe.js returns a native Promise - bring the result back into a digest
                $scope.$applyAsync(function(){ handle_confirm_result(result); });
            });
        }

        function handle_confirm_result(result){
            if(result.error){
                vm.submitting = false;
                vm.setup_error = result.error.message || "Your card could not be saved - please check the details and try again.";
                return;
            }

            var intent = result.setupIntent;
            if(!intent || intent.status !== 'succeeded'){
                vm.submitting = false;
                vm.setup_error = "Card setup did not complete - please try again.";
                return;
            }

            //finalise server-side: verifies with Stripe, sets the card as default
            //and links the Stripe customer to the member record
            var send = {
                setup_intent_id: intent.id,
                user_id: vm.user_id,
                club_id: vm.selected_club.club_id
            };
            PaymentService.ConfirmSetup(send)
            .then(function (data) {
                vm.submitting = false;
                //the card is attached at Stripe even if the finalise call hiccups,
                //so return to the list either way - it reads straight from Stripe
                ToastService.success('Card Added', 'Your new card has been saved.');
                $state.go('dashboard.my_account.payment_methods', { club_id: vm.selected_club.club_id });
            });
        }

        function return_url(){
            return $state.href('dashboard.my_account.payment_methods', { club_id: vm.selected_club.club_id }, { absolute: true });
        }

        function start_setup(){
            vm.setup_error = "";
            vm.card_ready = false;
            vm.setup_loading = true;
            teardown_element();

            var club_id = vm.selected_club.club_id;

            PaymentService.CreateNewCustomer({ club_id: club_id, user_id: vm.user_id })
            .then(function (data) {
                if(!data.success || !data.secret){
                    vm.setup_loading = false;
                    vm.setup_error = data.error || "Card payments aren't available for this club yet - please contact the club.";
                    return;
                }

                //GetClubStripeKey also waits for Stripe.js itself to load
                PaymentService.GetClubStripeKey(club_id).then(function(stripeKey){
                    stripe = Stripe(stripeKey);
                    elements = stripe.elements({ clientSecret: data.secret, appearance: {} });
                    paymentElement = elements.create('payment', { layout: 'tabs' });

                    //e.g. the SetupIntent expired before the form rendered
                    paymentElement.on('loaderror', function(){
                        $scope.$applyAsync(function(){
                            vm.card_ready = false;
                            vm.setup_error = "The card form couldn't be loaded - please go back and try again.";
                        });
                    });

                    //let the current digest render the (ng-show) container first
                    $timeout(function(){
                        paymentElement.mount('#payment-element');
                        vm.setup_loading = false;
                        vm.card_ready = true;
                    });
                }).catch(function(err){
                    vm.setup_loading = false;
                    if(err && err.code === 'stripe_js_unavailable'){
                        vm.setup_error = "We couldn't load the secure card form. Your network or a browser extension may be blocking js.stripe.com - please allow it and try again.";
                    } else {
                        vm.setup_error = "Card payments aren't set up for this club yet. Please contact the club.";
                    }
                }); // end GetClubStripeKey().then for add-card page
            });
        }

        function teardown_element(){
            if(paymentElement){
                try { paymentElement.destroy(); } catch(e) {}
                paymentElement = null;
            }
            elements = null;
            stripe = null;
        }

        function load_clubs(){
            MemberService.GetUserMemberships(vm.user_id)
            .then(function (data) {
                vm.clubs_loading = false;
                if(!data.success){
                    vm.setup_error = "We couldn't load your clubs - please try again shortly.";
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

                if(clubs.length == 0){
                    vm.setup_error = "You need a club membership before you can add a card.";
                    return;
                }

                //auto-start when the club is already known
                if($stateParams.club_id){
                    for(var i = 0; i < clubs.length; i++){
                        if(clubs[i].club_id == $stateParams.club_id){ vm.select_club(clubs[i]); return; }
                    }
                }
                if(clubs.length == 1){
                    vm.select_club(clubs[0]);
                }
                //otherwise wait for the user to pick a club
            });
        }

        $scope.$on('$destroy', teardown_element);

        load_clubs();

    }
