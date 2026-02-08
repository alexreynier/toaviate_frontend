app.factory('PaymentService', PaymentService);

    PaymentService.$inject = ['$http', '$location'];
    function PaymentService($http, $location) {
        var service = {};


        service.GetAddresses = GetAddresses;

        service.GetPaymentTypes = GetPaymentTypes;
        service.GetByUserId = GetByUserId;
        service.GetAuthority = GetAuthority;
        service.Create = Create;
        service.Delete = Delete;
        
        service.CreateCustom = CreateCustom;
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
        service.CreateSavedPaymentIntent = CreateSavedPaymentIntent; //ok
        service.CreateCardMachinePaymentIntent = CreateCardMachinePaymentIntent; //ok

        service.DeleteMemberCard = DeleteMemberCard;

        return service; 

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