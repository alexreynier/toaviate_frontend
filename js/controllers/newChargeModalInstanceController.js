 app.controller('NewChargeModalInstanceCtrl', NewChargeModalInstanceCtrl);

    NewChargeModalInstanceCtrl.$inject = ['$scope', '$uibModalInstance', 'id', 'warning', 'MemberService', 'ClubService', '$rootScope', 'PaymentService', 'params', 'EnvConfig', 'ToastService'];
    function NewChargeModalInstanceCtrl($scope, $uibModalInstance, id, warning, MemberService, ClubService, $rootScope, PaymentService, params=null, EnvConfig, ToastService) {         

            $scope.warning = warning;
            $scope.params = params;
            //console.log("APARAMS", params);

            $scope.to_refund = 0;
            $scope.reason = "";
            $scope.club_id = $rootScope.globals.currentUser.current_club_admin.id;

            $scope.club_settings = {};

            $scope.new_client = {
              first_name: "",
              last_name: "",
              email: ""
            };

            $scope.items = [];
            $scope.item = {
              title: "",
              quantity: 0,
              vat: 0,
              price: 0
            };

            $scope.selected_client;
            $scope.selected_card;

            $scope.members = [];

            $scope.show_direct_debit_details = false;

            ClubService.GetById($scope.club_id)
            .then(function(data){
                $scope.club_settings = data;
                $scope.item.vat = $scope.club_settings.vat_rate;
                $scope.club_settings.vat_registered = ($scope.club_settings.vat_registered == 1)? true : false;
                //console.log("settings", $scope.club_settings);
            });

            MemberService.GetAllByClub($scope.club_id)
                    .then(function(data){
                        $scope.members = data;   
                        $scope.members.unshift({id: -12, first_name: "New", last_name: "Client"});
                        // $scope.item.title = "hjel";
                        //console.log("members",$scope.members);
                    });


            $scope.delete_receipt = function(number){

                
              $scope.items.splice(number, 1);
           
              calculate_charges();

            }

            $scope.card_selected = function(data){
              $scope.selected_card = data;

              if(data.id == -12){
                 setTimeout(function(){
                  setupStripe();
                }, 1000);
              }

            }

            $scope.member_selected = function(data){
              //console.log("selected", data);
              
              $scope.selected_client = data;

              if(data && data.account_ending && data.account_ending !== ''){
                  $scope.show_direct_debit_details = true;
                } else {
                  $scope.show_direct_debit_details = false;
                   setTimeout(function(){
                    setupStripe();
                  }, 1000);


                }

              if(data && data.id == -12){
                
                setTimeout(function(){
                  setupStripe();
                }, 1000);

              } 
            }

            $scope.add_item = function(item_sent){
                $scope.item = item_sent;

                // //console.log("HELLO ADDING", item_sent);
                // //console.log("HELLO ADDING", $scope.items);

                $scope.items.push($scope.item);

                // //console.log("OBJ TO SEND: ", $scope.item);

               
                $scope.item = {
                            quantity: 0,
                            price: 0,
                            vat: $scope.club_settings.vat_rate,
                            title: ""
                          };

                calculate_charges();

            }


            function calculate_charges(){


              // //console.log("Calculate everything now...");
              var total = 0;
              var the_vat = 0;
              for(var i=0; i < $scope.items.length; i++){

                $scope.items[i].total = ($scope.items[i].quantity * $scope.items[i].price);
                if($scope.items[i].vat > 0){
                  this_vat = ( $scope.items[i].total * ($scope.items[i].vat / 100) );
                  the_vat = the_vat + this_vat;
                }
                total = total + $scope.items[i].total;

              }

              $scope.the_vat = the_vat;
              $scope.the_total = total;

            }






          $scope.ok = function () {
            // Validation
            if (!$scope.items || $scope.items.length < 1) {
                ToastService.error('No Items', 'Please add at least one item to the invoice.');
                return;
            }
            if (!$scope.selected_client || !$scope.selected_client.id) {
                ToastService.error('Missing: Client', 'Please select a client to charge.');
                return;
            }
            if ($scope.selected_client.id == -12) {
                if (!$scope.new_client.first_name || !$scope.new_client.first_name.trim()) {
                    ToastService.error('Missing: First Name', 'Please enter the new client\'s first name.');
                    return;
                }
                if (!$scope.new_client.last_name || !$scope.new_client.last_name.trim()) {
                    ToastService.error('Missing: Last Name', 'Please enter the new client\'s last name.');
                    return;
                }
                if (!$scope.new_client.email || !$scope.new_client.email.trim()) {
                    ToastService.error('Missing: Email', 'Please enter the new client\'s email address.');
                    return;
                }
            }
            var obj = params;


            //let's create all that is required to issue the invoice.
            if($scope.selected_client.id == -12){


              $scope.selected_client.first_name = $scope.new_client.first_name;
              $scope.selected_client.last_name = $scope.new_client.last_name;
              $scope.selected_client.email = $scope.new_client.email;

            } else{

               $scope.selected_client.first_name = $scope.selected_client.first_name;
               $scope.selected_client.last_name = $scope.selected_client.last_name;
               $scope.selected_client.email = $scope.selected_client.email;
            
            }

            if($scope.selected_client.id == -12 || !$scope.show_direct_debit_details){
              //if there is a custom card entered - then we continue here...

              var options = {};
              stripe.createToken(card, options).then(function(result) {
                if (result.error) {
                  // Inform the user if there was an error
                  var errorElement = document.getElementById('card-errors');
                  errorElement.textContent = result.error.message;
                } else {

                  //stripeTokenHandler(result.token);
                  ////console.log("RESULT", result);

                  if(result.token.id){
                    ////console.log("STUFF", result.token.id);

                    //prepare a basic object...
                    var card_obj = {
                        brand: result.token.card.brand,
                        last4: result.token.card.last4,
                        hash: result.token.card.id,
                        token: result.token.id,
                        funding: result.token.card.funding,
                        name: result.token.card.name,
                        client_ip: result.token.client_ip
                    };


                    var obj_to_send = {
                      payment: card_obj,
                      items: $scope.items,
                      user: $scope.selected_client,
                      club_id: $scope.club_id
                    };


                    // SAMPLE OF WHERE WE NEED TO SEND THE SHIZZLE....
                    PaymentService.CreateCustom(obj_to_send)
                    .then(function (data) {
                        if(data.success){

                            ////console.log("CARD: "+data);
                            //fill the drop down menu
                            //$state.go('dashboard.my_account.payment_methods', {}, { reload: true });
                            $uibModalInstance.close(data);
                        } else {
                            //console.log("WOOOPSIES...", data);
                            //this should be very very rare...

                        }
                    });
                    


                  }

                }
              });

            } else {

              //this should now be when we charge a saved card.

              //create a new charge request? is that server side?


              var obj_to_send = {
                  payment: {},
                  items: $scope.items,
                  user: $scope.selected_client,
                  club_id: $scope.club_id
                };

                if($scope.selected_client.account_ending !== ""){
                  obj_to_send.payment.direct_debit = true;
                }


              PaymentService.CreateCustom(obj_to_send)
                    .then(function (data) {
                        if(data.success){

                            ////console.log("CARD: "+data);
                            //fill the drop down menu
                            //$state.go('dashboard.my_account.payment_methods', {}, { reload: true });
                            $uibModalInstance.close(data);
                        } else {
                            //console.log("WOOOPSIES...", data);
                            //this should be very very rare...

                        }
                    });















              //then we don't need a stripe token...

               // SAMPLE OF WHERE WE NEED TO SEND THE SHIZZLE....
              // PaymentService.Create(obj)
              // .then(function (data) {
              //     if(data.success){

              //         //console.log("CARD: "+data);
              //         //fill the drop down menu
              //         $state.go('dashboard.my_account.payment_methods', {}, { reload: true });
                //            $uibModalInstance.close(obj);

              //     } else {
              //         //console.log("WOOOPSIES...", data);
              //         //this should be very very rare...

              //     }
              // });





            }
            




          };

          $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
          };

          $scope.params = function(params){
            return params;
          }









          //STRIPE STUFF HERE PLEASE!!! :-)


        var stripe = Stripe(EnvConfig.getStripeKeyLegacy());
        var elements = stripe.elements();

        var card_options = {
              hidePostalCode: true,
              style: {
                base: {
                  iconColor: '#666EE8',
                  color: '#31325F',
                  lineHeight: '40px',
                  fontWeight: 300,
                  fontFamily: 'Helvetica Neue',
                  fontSize: '15px',
                  '::placeholder': {
                    color: '#CFD7E0',
                  },
                },
              }
            };

        var card = elements.create('card', card_options);

        var run = false;
        var timeout;

        function setupStripe(){
            clearTimeout(timeout);
            if(run == false){
                run = true;

                card.mount('#card-element');
            
                form = document.getElementById('payment-form');
                form.addEventListener('submit', function(e) {
                  e.preventDefault();
                  createToken();
                });
            } 
        }   


        // $scope.$on('$viewContentLoaded', function(){
        //         clearTimeout(timeout);
        //         if(run2 == false){
        //             run2 = true;
        //             timeout = setTimeout(function(){ setupStripe(); }, 1500); 
        //         }
        // });

     

        function stripeTokenHandler(token) {
          // Insert the token ID into the form so it gets submitted to the server
          var form = document.getElementById('payment-form');
          var hiddenInput = document.createElement('input');
          hiddenInput.setAttribute('type', 'hidden');
          hiddenInput.setAttribute('name', 'stripeToken');
          hiddenInput.setAttribute('value', token.id);
          form.appendChild(hiddenInput);

          // Submit the form
          //console.log("TOKEN", token);
          //form.submit();
        }

        function create_invoice() {
          //console.log("HELLO CREATE TOKEN? 1");
           var options = {
            // name: document.getElementById('name').value,
            //  address_line1: document.getElementById('address-line1').value,
            // address_line2: document.getElementById('address-line2').value,
            // address_city: document.getElementById('address-city').value,
            // address_zip: document.getElementById('address-postcode').value,
            // address_country: document.getElementById('address-country').value,
          };

          stripe.createToken(card, options).then(function(result) {
            if (result.error) {
              // Inform the user if there was an error
              var errorElement = document.getElementById('card-errors');
              errorElement.textContent = result.error.message;
            } else {
              // Send the token to your server
              //stripeTokenHandler(result.token);
              ////console.log("RESULT", result);

              if(result.token.id){
              ////console.log("STUFF", result.token.id);

                //prepare a basic object...
                var obj = {
                    user_id: vm.user.id,
                    brand: result.token.card.brand,
                    last4: result.token.card.last4,
                    hash: result.token.card.id,
                    token: result.token.id,
                    funding: result.token.card.funding,
                    name: result.token.card.name,
                    client_ip: result.token.client_ip
                };


                PaymentService.Create(obj)
                .then(function (data) {
                    if(data.success){

                        //console.log("CARD: "+data);
                        //fill the drop down menu
                        $state.go('dashboard.my_account.payment_methods', {}, { reload: true });

                    } else {
                        //console.log("WOOOPSIES...", data);
                        //this should be very very rare...

                    }
                });



              }

            }
          });
        };







    }