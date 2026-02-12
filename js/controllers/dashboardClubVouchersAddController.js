 app.controller('DashboardClubVouchersAddController', DashboardClubVouchersAddController);

    DashboardClubVouchersAddController.$inject = ['UserService', 'PlaneService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'LicenceService', 'MedicalService', 'DifferencesService', 'ExperiencesService', 'VoucherService', 'EnvConfig', 'ToastService'];
    function DashboardClubVouchersAddController(UserService, PlaneService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, LicenceService, MedicalService, DifferencesService, ExperiencesService, VoucherService, EnvConfig, ToastService) {
        var vm = this;

        //console.log("HELLOOOO ADD vouchers");

        vm.user = null;
        vm.allUsers = [];
        vm.club = {
            item: {
            }
        };
        vm.page_title = "";
        
        vm.plane_document = {};
        vm.plane_documents = [];

        var update_this_file = [];
        

        vm.action = $state.current.data.action;
        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        vm.charge_type = ["brakes", "session", "plane"];

        vm.discounts = [];

        vm.planes = [];
        vm.show_paid = false;

        ExperiencesService.GetByClubId(vm.club_id)
                    .then(function(data){
                        //console.log("planes", data);
                        vm.experiences = data.items;
                    });




    
                //console.log("adding a new plane please");
                vm.page_title = "Add a Voucher";

                VoucherService.GetUniqueCode(vm.club_id)
                    .then(function(data){
                        //console.log(data);
                        vm.club.item.code = data.code;
                    });


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
                var form;

                var timeout;
                var run = false;
                var run2 = false;

                ExperiencesService.GetDiscountsByClubId(vm.club_id)
                .then(function(data){
                    //console.log("discounts", data);
                    vm.discounts = data.items;
                });

                function setupStripe(){
                    clearTimeout(timeout);
                    if(run == false){
                        run = true;

                        card.mount('#card-element');
                    
                        form = document.getElementById('payment-form2');
                        form.addEventListener('submit', function(e) {
                          e.preventDefault();
                          createToken();
                        });
                    } 
                }   
                $scope.$on('$viewContentLoaded', function(){
                        clearTimeout(timeout);
                        if(run2 == false){
                            run2 = true;
                            timeout = setTimeout(function(){ setupStripe(); }, 1500); 
                        }
                });

             

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

                function createToken() {
                  
                };




        //'9' needs to refer the the user's account set to manage
       

        $scope.check_code = function(){
            //console.log("CHECKING NOW");
        }

        $scope.back = function(){
            $window.history.back();
        }

        vm.clearFieldError = function(event) { ToastService.clearFieldError(event); };

        $scope.save = function(){
            var checks = [
                { ok: vm.club.item.experience && vm.club.item.experience.id, field: 'voucher_experience', label: 'Experience' },
                { ok: vm.club.item.first_name, field: 'first_name', label: 'First Name' },
                { ok: vm.club.item.last_name,  field: 'last_name',  label: 'Last Name' },
                { ok: vm.club.item.email,      field: 'email',      label: 'Email Address' },
                { ok: vm.club.item.code,       field: 'code',       label: 'Voucher Code' },
                { ok: vm.club.item.expiry_date, field: 'expiry_date', label: 'Expiry Date' }
            ];
            if (vm.already_paid) {
                checks.push({ ok: vm.club.item.price_paid != null && vm.club.item.price_paid >= 0, field: 'price_paid', label: 'Price Paid' });
                checks.push({ ok: vm.club.item.payment_method, field: 'payment_method', label: 'Payment Method' });
            }
            if (!ToastService.validateForm(checks)) return;

            if(vm.action == "add"){
                $scope.create();
            } else {
                $scope.update();
            }
        }

        $scope.create = function(){
            //console.log("CREATE ME NOW");


            //first sanity check goes here...
            if(!vm.club.item.experience || !vm.club.item.experience.id){
                ToastService.warning('Selection Required', 'You must select an experience to issue this voucher.');
                return false;
            }
            if(!vm.club.item.first_name || !vm.club.item.last_name || !vm.club.item.email){
                ToastService.warning('Missing Details', "You must enter the purchasor's first name, last name and email address.");
                return false;
            }

            if(vm.already_paid){
                if(vm.club.item.price_paid < 0 || !vm.club.item.payment_method){
                    ToastService.warning('Payment Required', 'Please fill in how much was paid and what payment method was used to complete the payment.');
                    return false;
                }
            }






            vm.club.item.experience_title = vm.club.item.experience.title;
            vm.club.item.experience_id = vm.club.item.experience.id;
            if(vm.club.item.discount && vm.club.item.discount.id >0){
                vm.club.item.discount_id = vm.club.item.discount.id;
            }

            //applying a discount?
            //vm.club.item.price = vm.club.item.experience.price;
            

           
            vm.club.item.club_id = vm.club_id;


            if(!vm.already_paid){

                   var options = {
                    name: document.getElementById('name').value,
                    address_zip: document.getElementById('address-postcode').value,
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
                            exp_month: result.token.card.exp_month,
                            exp_year: result.token.card.exp_year,
                            funding: result.token.card.funding,
                            name: result.token.card.name,
                            address_postcode: result.token.card.address_zip,
                            client_ip: result.token.client_ip
                        };

                        vm.club.item.payment = obj;

                        delete vm.club.item.experience;
                        //delete vm.club.item.discount;

                        //console.log("READY WITH : ", vm.club.item);
                        //return false;
                        
                        VoucherService.Create(vm.club.item)
                        .then(function(data){
                            //console.log(data);
                            //$state.reload();
                            $state.go('dashboard.manage_club.vouchers', {}, {reload: true});

                        });



                      }

                    }
                  });

              } else {
                //then the payment was already taken by other means...
                var obj = {
                    payment_method: vm.club.item.payment_method,
                    amount: vm.club.item.price_paid 
                }

                vm.club.item.price = vm.club.item.price_paid;

                vm.club.item.payment = obj;
                
                delete vm.club.item.payment_method;
                delete vm.club.item.price_paid;

                //console.log("READY WITH NO STRIPE : ", vm.club.item);

                        //return false;

                VoucherService.Create(vm.club.item)
                    .then(function(data){
                        //console.log(data);
                        //$state.reload();
                        $state.go('dashboard.manage_club.vouchers', {}, {reload: true});

                    });

              }



           
        }

        $scope.delete = function(){
            //console.log("CLICK");
            ToastService.warning('Confirm Delete', 'Are you sure you would like to delete this voucher?');
            VoucherService.Delete(vm.user.id, vm.club.item)
                .then(function(data){
                    //console.log(data);
                });
        }

        function get_update_docs(){
            var documents = [];

            for(var i=0;i<update_this_file.length;i++){
                var id = update_this_file[i];
                //console.log("looking for : ", id);
                //console.log("in: ", vm.plane_documents);

                for(var k=0;k<vm.club.plane.plane_documents.length;k++){
                    //console.log("comparing to : ", vm.club.plane.plane_documents[k].id);
                    if(vm.club.plane.plane_documents[k].id == id){
                        documents.push(vm.club.plane.plane_documents[k]);
                    }
                }

            }

            // //console.log("DOCS TO UPDATE : ", documents);
            return documents;
        }

        $scope.update = function(){
            //console.log("CLICK");
            vm.club.item.club_id = vm.club_id;
            VoucherService.Update(vm.club.item, vm.user.id)
                .then(function(data){
                    //console.log(data);
                    //console.log("saved");
                    //$state.reload();
                    $state.go('dashboard.manage_club.vouchers', {}, {reload: true});
                });
        }

        $scope.update_experience = function(){
            //console.log("UPDATE EXP");
            var days = vm.club.item.experience.valid_for;
            if(days > 0){
                 var expiry_date = moment().day(+days);
                //console.log("NEW DATE: ", expiry_date);
                vm.club.item.expiry_date = new Date(expiry_date);
            } else {
                var expiry_date = moment().year(+2100);
                vm.club.item.expiry_date = new Date(expiry_date);
            }
            vm.club.item.price = vm.club.item.experience.price;

            ExperiencesService.GetDiscountsByClubIdAndExperienceId(vm.club_id, vm.club.item.experience.id)
            .then(function(data){
                ////console.log("discounts", data);
                vm.discounts = data.items;
            });

        }

        $scope.update_discount = function(){

            if(vm.club.item.discount.discount_type == 1){
                //fixed price
                vm.club.item.price = vm.club.item.discount.price;
            } else {
                //percentage...
                vm.club.item.price = vm.club.item.experience.price - (vm.club.item.experience.price * (vm.club.item.discount.percentage / 100) );

            }

        }

        function containsObject(obj, list, params) {

            // //console.log("obj", obj);
            // //console.log("list", list);
            // //console.log("params", params);

            for(var i=0; i<list.length; i++) {
                // //console.log("list i : ", list[i]);
                // //console.log("obj is: ", obj);

                var count_success = 0;
                for(var j=0;j<params.length;j++){
                    if(list[i][params[j]] && obj[params[j]] && list[i][params[j]] == obj[params[j]]){
                        count_success++;
                    }
                }

                if(count_success === params.length) {                    
                    return true;
                }
            }

            return false;
        }




        function check_all(){

            //maybe a nice to have one day... not yet though.


            //licences
            vm.club.plane.requirements.licence.forEach(function(obj){

            });

        }

      

        initController();

        function initController() {




        }


        var warning_msg = "By deleting this plane, you will also cancel all reservations that this plane currently has."

          $scope.open = function (plane_id) {
            var modalInstance = $uibModal.open({
              animation: true,
              templateUrl: 'views/modals/deleteModal.html',
              controller: 'ModalInstanceCtrl',
              size: "lg",
              resolve: {
                id: function () {
                  return plane_id;
                },
                params: function() {
                  return {id: plane_id};
                },
                warning: function(){
                    return warning_msg;
                }
              }
            });
            modalInstance.result.then(function (plane_id) {
              $log.info('PRESSED GO: '+plane_id.id);
              ExperiencesService.Delete(vm.user.id, plane_id.id)
              .then(function(){
                //console.log("HELLO DELETE");
                //update view?
                 vm.club.items = $.grep(vm.club.items, function(e){ 
                    return e.id != plane_id.id; 
                });
              })
            }, function () {
              $log.info('Modal dismissed at: ' + new Date());
            });
          };

         


    }