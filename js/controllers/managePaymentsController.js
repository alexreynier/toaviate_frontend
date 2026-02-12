 app.controller('ManagePaymentsController', ManagePaymentsController);

    ManagePaymentsController.$inject = ['UserService', '$sce', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'PaymentService', 'PoidService', 'ToastService'];
    function ManagePaymentsController(UserService, $sce, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, PaymentService, PoidService, ToastService) {
        
        var vm = this;        

        vm.poid_images = [];
        vm.poid = {
                images: []
        };


        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        vm.customer_token = "";
        $scope.iframe_url = "";

        vm.change_address = false;


        vm.billing_address = {
            flatNumber: "",
            houseNameNumber: "",
            townCity: "",
            region: "",
            postalCode: "",
            countryISO: ""
        }





        // var stripe = Stripe('pk_test_Ers4ZfdIMZ59ac4wKy6FDAH2');
        // var elements = stripe.elements();

        // var card_options = {
        //       hidePostalCode: true,
        //       style: {
        //         base: {
        //           iconColor: '#666EE8',
        //           color: '#31325F',
        //           lineHeight: '40px',
        //           fontWeight: 300,
        //           fontFamily: 'Helvetica Neue',
        //           fontSize: '15px',
        //           '::placeholder': {
        //             color: '#CFD7E0',
        //           },
        //         },
        //       }
        //     };

        // var card = elements.create('card', card_options);
        // var form;


        // var timeout;
        // var run = false;
        // var run2 = false;


        // function setupStripe(){
        //     clearTimeout(timeout);
        //     if(run == false){
        //         run = true;

        //         card.mount('#card-element');
            
        //         form = document.getElementById('payment-form');
        //         form.addEventListener('submit', function(e) {
        //           e.preventDefault();
        //           createToken();
        //         });
        //     } 
        // }   


        // $scope.$on('$viewContentLoaded', function(){
        //         clearTimeout(timeout);
        //         if(run2 == false){
        //             run2 = true;
        //             timeout = setTimeout(function(){ setupStripe(); }, 1500); 
        //         }
        // });

     

        // function stripeTokenHandler(token) {
        //   // Insert the token ID into the form so it gets submitted to the server
        //   var form = document.getElementById('payment-form');
        //   var hiddenInput = document.createElement('input');
        //   hiddenInput.setAttribute('type', 'hidden');
        //   hiddenInput.setAttribute('name', 'stripeToken');
        //   hiddenInput.setAttribute('value', token.id);
        //   form.appendChild(hiddenInput);

        //   // Submit the form
        //   //console.log("TOKEN", token);
        //   //form.submit();
        // }

        // function createToken() {
        //   //console.log("HELLO CREATE TOKEN? 1");
        //    var options = {
        //     name: document.getElementById('name').value,
        //      address_line1: document.getElementById('address-line1').value,
        //     address_line2: document.getElementById('address-line2').value,
        //     address_city: document.getElementById('address-city').value,
        //     address_zip: document.getElementById('address-postcode').value,
        //     address_country: document.getElementById('address-country').value,
        //   };

        //   stripe.createToken(card, options).then(function(result) {
        //     if (result.error) {
        //       // Inform the user if there was an error
        //       var errorElement = document.getElementById('card-errors');
        //       errorElement.textContent = result.error.message;
        //     } else {
        //       // Send the token to your server
        //       //stripeTokenHandler(result.token);
        //       ////console.log("RESULT", result);

        //       if(result.token.id){
        //       ////console.log("STUFF", result.token.id);

        //         //prepare a basic object...
        //         var obj = {
        //             user_id: vm.user.id,
        //             brand: result.token.card.brand,
        //             last4: result.token.card.last4,
        //             hash: result.token.card.id,
        //             token: result.token.id,
        //             exp_month: result.token.card.exp_month,
        //             exp_year: result.token.card.exp_year,
        //             funding: result.token.card.funding,
        //             name: result.token.card.name,
        //             address_postcode: result.token.card.address_zip,
        //             client_ip: result.token.client_ip
        //         };


        //         PaymentService.Create(obj)
        //         .then(function (data) {
        //             if(data.success){

        //                 //console.log("CARD: "+data);
        //                 //fill the drop down menu
        //                 $state.go('dashboard.my_account.payment_methods', {}, { reload: true });

        //             } else {
        //                 //console.log("WOOOPSIES...", data);
        //                 //this should be very very rare...

        //             }
        //         });



        //       }

        //     }
        //   });
        // };

        vm.change_address_for = "";


        $scope.change_address = function(card_id){

            vm.change_address_for = card_id;

            PaymentService.GetCardDetails(card_id)
                .then(function (data) {
                    if(data){

                        //console.log("addresses: "+data.billingAddress);
                        vm.billing_address = data.billingAddress;
                        //fill the drop down menu
                        vm.change_address = true;

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...

                    }
                });

            // const card_deets = await response.json();



        }


        $scope.save_address = function(){
            //vm.change_address_for

            //vm.billing_address


            //update_address here to PHP which will do the rest :-D 
             PaymentService.UpdateCard(vm.change_address_for, vm.billing_address)
                .then(function (data) {
                    if(data){

                        //console.log("addresses: "+data);
                        vm.billing_address = {
                            flatNumber: "",
                            houseNameNumber: "",
                            townCity: "",
                            region: "",
                            postalCode: "",
                            countryISO: ""
                        }

                        ToastService.success('Address Saved', 'Address saved successfully.');

                        //fill the drop down menu
                        vm.change_address = false;

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...

                    }
                });


        }


        $scope.decline_change = function(){
            vm.change_address = false;
        }




        // Create a token when the form is submitted.
        
        $scope.get_addresses = function(){

            //  trial key
            //  auth: api-key: BP-8KOdw8ka3F2eDU-Zz-g5865   
            //  https://api.getAddress.io/v2/uk/{postcode}
            // PaymentService.getAddress()

            // PaymentService.GetAddresses(vm.postcode)
            //     .then(function (data) {
            //         if(data.success){

            //             //console.log("addresses: "+data.addresses);
            //             vm.addresses = data.addresses;
            //             //fill the drop down menu

            //         } else {
            //             //console.log("WOOOPSIES...");
            //             //this should be very very rare...

            //         }
            //     });GetCardDetails

        }


        function prefill_details(){

            // UserService

            document.getElementById('name').value = "";
            document.getElementById('address-line1').value = "";
            document.getElementById('address-line2').value = "";
            document.getElementById('address-city').value = "";
            document.getElementById('address-postcode').value = "";
            document.getElementById('address-country').value = "";
        }


        $scope.changePrimary = function(card_id){


            PaymentService.ChangePrimary(vm.user.id, card_id)
                            .then(function (data) {
                                //console.log(data);
                                if(data.success){            

                                    ToastService.success('Card Updated', 'Changed primary card!');
                                    
                                    //vm.cards = data.cards;
                                    ////console.log("CARDS", vm.cards);
                                } else {
                                   // //console.log("WOOOPSIES...");
                                    //this should be very very rare...
                                }
                            });




        }


        $scope.add_card = function () {
            

            createToken();


            // //console.log("CLICK");   

            //     var $form = $('#payment-form');
            //     $form.submit(function(event) {
            //     // Disable the submit button to prevent repeated clicks:
            //     $form.find('.submit').prop('disabled', true);

            //     // Request a token from Stripe:
            //     //stripe.card.createToken($form, stripeResponseHandler);
            //     //pk_test_Ers4ZfdIMZ59ac4wKy6FDAH2


            //     stripe.createToken($form).then(function(result) {
            //       // Handle result.error or result.token
            //       //console.log(result);
            //     });

            //     // Prevent the form from being submitted:
            //     return false;
            //   });


        };


        $scope.delete_card = function(id){
            //console.log("ID", id);
            var b = prompt("Please write YES to confirm you wish to delete the card");
            if(b == "YES"){
                ////console.log("yes");
                PaymentService.Delete(id, vm.user.id)
                .then(function (data) {

                        ////console.log("delete: ", data);
                        //fill the drop down menu
                        PaymentService.GetByUserId(vm.user.id)
                            .then(function (data) {
                                //console.log(data);
                                if(data.success){
                                    vm.cards = data.cards;
                                    ////console.log("CARDS", vm.cards);
                                } else {
                                   // //console.log("WOOOPSIES...");
                                    //this should be very very rare...
                                }
                            });
                  
                });
            }
            
        }

      


                PaymentService.GetByUserId(vm.user.id)
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

        


    }