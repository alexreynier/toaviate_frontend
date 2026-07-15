app.factory('PaymentService', PaymentService);

    PaymentService.$inject = ['$http', '$location', '$q'];
    function PaymentService($http, $location, $q) {
        var service = {};

        // Per-club Stripe publishable key cache. The key is club- AND mode-specific
        // (a club may be sandbox while another is live), so it must be fetched from
        // payment_mode/{club_id}/config — never hard-coded. Cached per session.
        var _stripeKeyCache = {};


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

        return service;

        // Resolve a club's Stripe publishable key (per-club, per payment mode).
        // Returns a promise that resolves to the publishable key string. Cached so
        // repeated payment flows in a session only hit the network once per club.
        // Call ClearClubStripeKey after a mode switch so the new mode's key is
        // fetched fresh.
        //
        // REJECTS with { code: 'not_configured' } when the club has no usable
        // publishable key — e.g. a club flipped to live before that server's live
        // keys were filled in (stripe_publishable_key_present === false). Card-mount
        // flows should .catch this and show a "card payments aren't configured yet"
        // message rather than letting Stripe.js throw on an empty key.
        function GetClubStripeKey(club_id) {
            if (_stripeKeyCache[club_id]) {
                return $q.when(_stripeKeyCache[club_id]);
            }
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
                _stripeKeyCache[club_id] = key;
                return key;
            }, function(res){
                if (res && res.status == 401) { $location.path('/login'); }
                return $q.reject({ code: 'fetch_failed', status: res && res.status });
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