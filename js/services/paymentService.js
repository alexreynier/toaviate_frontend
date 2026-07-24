app.factory('PaymentService', PaymentService);

    PaymentService.$inject = ['$http', '$location', '$q', '$timeout'];
    function PaymentService($http, $location, $q, $timeout) {
        var service = {};

        // Per-club Stripe publishable key cache. The key is club- AND mode-specific
        // (a club may be sandbox while another is live), so it must be fetched from
        // payment_mode/{club_id}/config — never hard-coded. Entries expire after
        // KEY_CACHE_TTL_MS so a session that was open across a payment-mode switch
        // picks up the new mode's key within minutes instead of holding the stale
        // one until reload (a stale key pairs old-mode Elements with new-mode
        // intents and fails at confirm).
        var _stripeKeyCache = {};
        var KEY_CACHE_TTL_MS = 10 * 60 * 1000;


        service.GetAddresses = GetAddresses;

        service.GetPaymentTypes = GetPaymentTypes;
        service.GetByUserId = GetByUserId;
        service.GetAuthority = GetAuthority;
        service.Create = Create;
        service.Delete = Delete;
        
        service.CreateCustom = CreateCustom;
        service.CreateCustom2 = CreateCustom2;  
        service.CompleteCustom = CompleteCustom;

        service.Create2 = Create2;
        service.UpdateCard = UpdateCard;
        service.GetUserForPayment = GetUserForPayment;
        service.GetCardDetails = GetCardDetails;
        service.ChangePrimary = ChangePrimary;

        service.GenerateStripeLink = GenerateStripeLink;
        service.SaveStripeLink = SaveStripeLink;
        service.RefreshStripeLink = RefreshStripeLink;
        service.CreateCardIntent = CreateCardIntent;
        service.CreatePaymentIntent = CreatePaymentIntent;
        service.CreateNewCustomer = CreateNewCustomer;
        service.GetMemberCards = GetMemberCards;
        service.UpdateDefaultCard = UpdateDefaultCard;


        service.ProcessPayment = ProcessPayment;


        //create_saved_card_intent
        //create_payment_intent_new_card
        //create_cardmachine_intent

        service.CreatePaymentIntentNewCard = CreatePaymentIntentNewCard; //ok
        service.SetSaveCardOnIntent = SetSaveCardOnIntent;
        service.CreateSavedPaymentIntent = CreateSavedPaymentIntent; //ok
        service.CreateCardMachinePaymentIntent = CreateCardMachinePaymentIntent; //ok

        service.DeleteMemberCard = DeleteMemberCard;

        service.GetClubStripeKey = GetClubStripeKey;
        service.ClearClubStripeKey = ClearClubStripeKey;
        service.WaitForStripeJs = WaitForStripeJs;
        service.ConfirmSetup = ConfirmSetup;

        return service;

        // Stripe.js is loaded async from the CDN in index.html, so it may not be
        // available yet (slow network) or ever (js.stripe.com blocked by a content
        // blocker). Resolves once the global Stripe constructor exists; rejects
        // with { code: 'stripe_js_unavailable' } after ~10s so payment flows can
        // show a helpful message instead of throwing 'Stripe is not defined'.
        function WaitForStripeJs() {
            var deferred = $q.defer();
            var waited = 0;
            check();
            return deferred.promise;

            function check() {
                if (typeof Stripe !== 'undefined') { deferred.resolve(true); return; }
                if (waited >= 10000) { deferred.reject({ code: 'stripe_js_unavailable' }); return; }
                waited += 300;
                $timeout(check, 300);
            }
        }

        // Resolve a club's Stripe publishable key (per-club, per payment mode).
        // Returns a promise that resolves to the publishable key string — and only
        // once Stripe.js itself has loaded, so callers can safely call Stripe(key)
        // in their .then without their own load guard. Cached (with TTL) so
        // repeated payment flows in a session rarely hit the network. Call
        // ClearClubStripeKey after a mode switch so the new mode's key is fetched
        // fresh.
        //
        // REJECTS with:
        //   { code: 'not_configured' }        — club has no usable publishable key,
        //     e.g. flipped to live before that server's live keys were filled in
        //     (stripe_publishable_key_present === false). Show "card payments
        //     aren't configured for this club yet".
        //   { code: 'stripe_js_unavailable' } — Stripe.js never loaded (CDN slow
        //     or blocked). Show "couldn't load the secure card form".
        //   { code: 'fetch_failed' }          — config endpoint errored.
        function GetClubStripeKey(club_id) {
            var cached = _stripeKeyCache[club_id];
            if (cached && (Date.now() - cached.at) < KEY_CACHE_TTL_MS) {
                return WaitForStripeJs().then(function(){ return cached.key; });
            }
            return WaitForStripeJs().then(function(){
                return $http.get('/api/v1/payment_mode/' + club_id + '/config').then(function(res){
                    var data = res.data || {};
                    var key = data.stripe_publishable_key;
                    // present flag is authoritative; fall back to a truthy key if absent.
                    var present = (typeof data.stripe_publishable_key_present !== 'undefined')
                        ? data.stripe_publishable_key_present
                        : !!key;
                    if (!present || !key) {
                        return $q.reject({ code: 'not_configured', payment_mode: data.payment_mode });
                    }
                    _stripeKeyCache[club_id] = { key: key, at: Date.now() };
                    return key;
                }, function(res){
                    if (res && res.status == 401) { $location.path('/login'); }
                    return $q.reject({ code: 'fetch_failed', status: res && res.status });
                });
            });
        }

        function ClearClubStripeKey(club_id) {
            delete _stripeKeyCache[club_id];
        }

        function ProcessPayment(send){
            return $http.post('/api/v1/payments/process_payment', send).then(handleSuccess, handleError2);
        }

        function UpdateDefaultCard(send){
            return $http.post('/api/v1/cards/update_default_card', send).then(handleSuccess, handleError2);
        }

        function DeleteMemberCard(send){
            return $http.post('/api/v1/cards/delete_member_card', send).then(handleSuccess, handleError2);
        }

        //settings for the licences... not sure they'll be required anywhere else - so keep em here now...
        function GetMemberCards(send){
            return $http.post('/api/v1/cards/get_member_cards', send).then(handleSuccess, handleError2);
        }
        //create_new_customer
        function CreateNewCustomer(send){
            return $http.post('/api/v1/cards/create_new_customer', send).then(handleSuccess, handleError2);
        }

        // Finalises a succeeded SetupIntent: backend verifies it with Stripe, sets
        // the new card as the customer's default and links the customer to the
        // member record. send = { setup_intent_id, user_id, club_id }.
        function ConfirmSetup(send){
            return $http.post('/api/v1/cards/confirm_setup', send).then(handleSuccess, handleError2);
        }

        //create_cardmachine_intent_booking
        function CreateCardMachinePaymentIntent(send){
            return $http.post('/api/v1/cards/create_cardmachine_intent', send).then(handleSuccess, handleError2);
        }

        function CreateSavedPaymentIntent(send){
            return $http.post('/api/v1/cards/create_saved_card_intent', send).then(handleSuccess, handleError2);
        }

        function CreateCardIntent(send){
            return $http.post('/api/v1/cards/create_card_intent', send).then(handleSuccess, handleError2);
        }

        function CreatePaymentIntent(send){
            return $http.post('/api/v1/cards/create_payment_intent', send).then(handleSuccess, handleError2);
        }

        function CreatePaymentIntentNewCard(send){
            return $http.post('/api/v1/cards/create_payment_intent_new_card', send).then(handleSuccess, handleError2);
        }

        // Marks an in-flight payment intent so the card is saved to the payer's
        // Stripe customer on confirmation — must be called BEFORE confirmPayment.
        function SetSaveCardOnIntent(send){
            return $http.post('/api/v1/cards/save_card_on_intent', send).then(handleSuccess, handleError2);
        }

        //create_payment_intent_new_card

        function SaveStripeLink(club_id, stripe_id){
            var details = {"club_id": club_id, "stripe_id": stripe_id};
            return $http.post('/api/v1/cards/save_stripe_id', details).then(handleSuccess, handleError2);
        }

        function RefreshStripeLink(club_id, stripe_id){
            var details = {"club_id": club_id, "stripe_id": stripe_id};
            return $http.post('/api/v1/cards/refresh_stripe_id', details).then(handleSuccess, handleError2);
        }

        function GenerateStripeLink(details){
            return $http.post('/api/v1/cards/create_onboarding_link', details).then(handleSuccess, handleError2);
        }


        function GetAddresses(postcode){
            return $http.get('/api/v1/addresses/'+postcode).then(handleSuccess, handleError2);
        }

        function GetPaymentTypes() {
            return $http.get('/api/v1/poid_components').then(handleSuccess, handleError2);
        }

        function GetAuthority() {
            return $http.get('/api/v1/authority').then(handleSuccess, handleError2);
        }

        function GetUserForPayment(user_id) {
            return $http.get('/api/v1/cards/user/'+user_id).then(handleSuccess, handleError2);
        }

        function GetByUserId(user_id){
            return $http.get('/api/v1/cards/'+user_id).then(handleSuccess, handleError2);
        }

        function Create(card) {
            return $http.post('/api/v1/cards', card).then(handleSuccess, handleError2);
        }

        function UpdateCard(card_id, address){
            return $http.put('/api/v1/cards/'+card_id, address).then(handleSuccess, handleError2);
        }

        function ChangePrimary(user_id, card_id){
            return $http.put('/api/v1/cards/primary/'+card_id, {user_id: user_id}).then(handleSuccess, handleError2);
        }
        

        function Create2(user_id, card_id){
            var obj = {
                user_id: user_id,
                card_id: card_id
            }
            return $http.post('/api/v1/cards', obj).then(handleSuccess, handleError2);
        }


        function CreateCustom(payment){
            return $http.post('/api/v1/payments/custom', payment).then(handleSuccess, handleError2);
        }

        function CreateCustom2(payment){
            return $http.post('/api/v1/payments/custom_credit', payment).then(handleSuccess, handleError2);
        }

        function CompleteCustom(payment){
            return $http.post('/api/v1/payments/complete_custom', payment).then(handleSuccess, handleError2);
        }


        function GetCardDetails(card_id){
            return $http.post('/api/v1/cards/address', {"card": card_id}).then(handleSuccess, handleError2);
        }

        function Delete(id, user_id) {
            return $http.delete('/api/v1/cards/' + id+'?user_id='+user_id).then(handleSuccess, handleError2);
        }

     
        
        function handleError2(res) {
            console.log("ERROR", res);

            if(res.status == 401){
                $location.path('/login');
            }    

            return { success: false, message: res.data, status: res.status };
        }

        // private functions

        function handleSuccess(res) {
            return res.data;
        }

        function handleError(error) {
            return function () {
                return { success: false, message: error };
            };
        }
    }