 app.controller('ClubPaymentsController', ClubPaymentsController);

    ClubPaymentsController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'PaymentService', 'PoidService'];
    function ClubPaymentsController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, PaymentService, PoidService) {
        
        var vm = this;        

        vm.poid_images = [];
        vm.poid = {
                images: []
        };
        
        // vm.user_id = 59;
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        vm.customer_token = "";


        // function stripeResponseHandler(status, response) {
        //   // Grab the form:
        //   var $form = $('#payment-form');

        //   if (response.error) { // Problem!

        //     // Show the errors on the form:
        //     $form.find('.payment-errors').text(response.error.message);
        //     $form.find('.submit').prop('disabled', false); // Re-enable submission

        //   } else { // Token was created!

        //     // Get the token ID:
        //     var token = response.id;

        //     //console.log("CARD TOKEN IS: "+token);

        //     // Insert the token ID into the form so it gets submitted to the server:
        //     $form.append($('<input type="hidden" name="stripeToken">').val(token));

        //     // Submit the form:
        //     //$form.get(0).submit();
        //   }
        // };


        $scope.get_addresses = function(){

            //  trial key
            //  auth: api-key: BP-8KOdw8ka3F2eDU-Zz-g5865   
            //  https://api.getAddress.io/v2/uk/{postcode}
            // PaymentService.getAddress()

            PaymentService.GetAddresses(vm.postcode)
                .then(function (data) {
                    if(data.success){

                        //console.log("addresses: "+data.addresses);
                        vm.addresses = data.addresses;
                        //fill the drop down menu

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...

                    }
                });



        }


        // $scope.add_card = function () {
           
        //         var $form = $('#payment-form');
        //         $form.submit(function(event) {
        //         // Disable the submit button to prevent repeated clicks:
        //         $form.find('.submit').prop('disabled', true);

        //         // Request a token from Stripe:
        //         Stripe.card.createToken($form, stripeResponseHandler);

        //         Stripe.bankAccount.createToken('bank_account', {
        //           country: 'gb',
        //           currency: 'gbp',
        //           routing_number: '110000000',
        //           account_number: '000123456789',
        //           account_holder_name: 'Jenny Rosen',
        //           account_holder_type: 'individual',
        //         }).then(function(result) {
        //           // handle result.error or result.token
        //         });



        //         // Prevent the form from being submitted:
        //         return false;
        //       });


        // };



        switch($state.current.data.action){
            case "add":

                    //vm.selected_component = vm.components[0];
                    //vm.selected_component = 
                    

                    // //console.log("AA", vm.selected_component);

            

            break;
            case "edit":

            // //console.log("EDIT ONE");
            // //console.log("PARAMS: ", $stateParams);

             PoidService.GetById($stateParams.card_id)
                .then(function (data) {
                    if(data.success){
                        vm.poid = data.poid;
                        vm.poid.expiry_date = new Date(vm.poid.expiry_date);

                        
                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });



            break;
            case "list":

                //console.log("LIST ALL");

                 //list stuff

                PaymentService.GetByUserId(vm.user_id)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        vm.cards = data.cards;
                        //console.log("CARDS", vm.cards);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });


            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  
        


    }