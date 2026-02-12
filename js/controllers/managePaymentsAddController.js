 app.controller('ManagePaymentsAddController', ManagePaymentsAddController);

    ManagePaymentsAddController.$inject = ['UserService', '$sce', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'PaymentService', 'PoidService', 'ToastService'];
    function ManagePaymentsAddController(UserService, $sce, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, PaymentService, PoidService, ToastService) {
        
        var vm = this;        

        vm.poid_images = [];
        vm.poid = {
                images: []
        };


        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        vm.customer_token = "";
        $scope.iframe_url = "";


        // Create a token when the form is submitted.
        
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


        function prefill_details(){

            // UserService

            document.getElementById('name').value = "";
            document.getElementById('address-line1').value = "";
            document.getElementById('address-line2').value = "";
            document.getElementById('address-city').value = "";
            document.getElementById('address-postcode').value = "";
            document.getElementById('address-country').value = "";
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






                    //vm.selected_component = vm.components[0];
                    //vm.selected_component = 
        function get_paybase_token(){


                
                    // //console.log("AA", vm.selected_component);
                PaymentService.GetUserForPayment(vm.user.id)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //console.log("CAT DATA", data);
                        vm.cards = data.cards;
                        vm.customer_token = data.token;

                        $scope.iframe_url = $sce.trustAsResourceUrl("https://hosted.sandbox.paybase.io/card?t="+vm.customer_token);
                        var i = 0;

                        // alert("URL ADDED");
                        // $scope.$apply();

                        //console.log("URL", vm.iframe_url);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

            }


            //paybase integration

              var errors = document.querySelector('.errors');
              var success = document.querySelector('.success');

              window.addEventListener('message', function(ev) {
                var data = ev.data;
                //console.log("received data", data);

                //angular.element(paybase_response(data));
                switch (data.type) {
                  case 'success': {
                    ////console.log("received data", data);
                    //success.innerText = data.id;

                    //add card into our own system....


                    //the response is no longer the full card object that I require - so I will send the card_id and the customer_id to the backend for it to do its magic
                    //and when it has querried Paybase, and added the card on our system, THEN we can throw them back onto the ALL CARDS page.

                    PaymentService.Create2(vm.user.id, data.id)
                    .then(function (data2) {

                        if(data2.success){

                            //card was successfully added to the system... Time to boot them back to the previous page...

                            $state.go('dashboard.my_account.payment_methods', {}, { reload: true });





                        } else {
                            //console.log("There was a ToAviate error in adding your card into our system. Please try again later.");
                        }
                           
                      
                    });





                  }
                  break;
                  case 'error': {
                    //errors.innerText = data.message;  
                    //alert(data.message);


                    // if(data.code == "5002"){
                    //     alert("Please check your card details are correct and match your billing address.");
                    //     $scope.iframe_url = $sce.trustAsResourceUrl("https://hosted.sandbox.paybase.io/card?t="+vm.customer_token);
                    // } else {
                    // }


                    switch(data.code){

                        case "5002":
                            //card declined / incorrect details
                            ToastService.error('Card Declined', 'Your card was declined, please verify your details or contact your card provider. Should this problem persist, please contact: info@toaviate.com');

                        break;
                        case "4060":
                            //card used to exist....?
                            ToastService.warning('Duplicate Card', 'It appears that you are adding a card that has already been added to your account');

                        break;
                        default:
                            ToastService.error('Card Error', 'Please check your card details are correct and match your billing address.');

                        break;



                    }








                    get_paybase_token();


                    //location.reload();
                  }
                  break;
                        }
            });


                            
                
          


            get_paybase_token();


    }