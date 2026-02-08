 app.controller('DashboardClubVouchersEditController', DashboardClubVouchersEditController);

    DashboardClubVouchersEditController.$inject = ['UserService', 'PlaneService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'LicenceService', 'MedicalService', 'DifferencesService', 'ExperiencesService', 'VoucherService'];
    function DashboardClubVouchersEditController(UserService, PlaneService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, LicenceService, MedicalService, DifferencesService, ExperiencesService, VoucherService) {
        var vm = this;

        //console.log("HELLOOOO vouchers");

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

        vm.show_paid = true;
   

        ExperiencesService.GetByClubId(vm.club_id)
                    .then(function(data){
                        //console.log("planes", data);
                        vm.experiences = data.items;
                    });

  

               
                VoucherService.GetById($stateParams.id)
                    .then(function(data){



                            data.item.expiry_date = new Date(data.item.expiry_date);
                            vm.club.item = data.item; 

                            //console.log(vm.club);

                        
                        // vm.page_title = "Edit an Experience - "+vm.club.item.title;
                    });


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

        //'9' needs to refer the the user's account set to manage
       

        $scope.check_code = function(){
            //console.log("CHECKING NOW");
        }

        $scope.back = function(){
            $window.history.back();
        }

        $scope.save = function(){
            if(vm.action == "add"){
                //console.log("CREATE click");
                $scope.create();
            } else {
                //console.log("EDIT click");
                //console.log(vm.club.plane);
                $scope.update();
            }
        }


        $scope.create = function(){
            //console.log("CREATE ME NOW");


            //first sanity check goes here...
            if(!vm.club.item.experience || !vm.club.item.experience.id){
                alert("You must select an experience to issue this voucher...");
                return false;
            }
            if(!vm.club.item.first_name || !vm.club.item.last_name || !vm.club.item.email){
                alert("You must enter the purchasor's first name, last name and email address.");
                return false;
            }

            if(vm.already_paid){
                if(!vm.club.item.price_paid || !vm.club.item.payment_method){
                    alert("Please fill in how much was paid and what payment method was used to complete the payment");
                    return false;
                }
            }








            vm.club.item.experience_title = vm.club.item.experience.title;
            vm.club.item.experience_id = vm.club.item.experience.id;
            vm.club.item.discount_id = vm.club.item.discount.id;

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


        $scope.cancel = function(){

            VoucherService.CancelVoucher(vm.user.id, vm.club.item.id)
                .then(function(data){
                    //console.log(data);
                    $state.go('dashboard.manage_club.vouchers', {}, {reload: true});
                });

        }

        $scope.delete = function(){
            //console.log("CLICK");
            alert("Are you sure you would like to delete this plane?");
            VoucherService.CancelVoucher(vm.user.id, vm.club.item)
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

      



        $scope.add_item = function(type){
            //console.log("ADD");
            switch(type){
                case "plane":
                    //console.log("plane");
                    if(vm.temporary.plane && vm.temporary.plane !== ""){
                        //then we can add it
                        //console.log("here we go");
                        // var add_plane = {
                        //     id: vm.temporary.plane.id
                        // };

                        //check if it doesnt exist first...
                        //if(vm.club.item.planes && vm.club.item.planes.indexOf(vm.temporary.plane.plane_id) == -1){


                        if(!vm.club.item.planes){
                            vm.club.item.planes = [];
                        }

                        if(containsObject(vm.temporary.plane, vm.club.item.planes, new Array("plane_id") ) == false){
                            vm.club.item.planes.push(vm.temporary.plane);

                            // vm.club.item.planes.indexOf(vm.temporary.plane)
                            // vm.planes.filter(function(el) { return el.plane_id !== vm.temporary.plane.plane_id; });
                        } 

                        delete vm.temporary.plane;

                    } else {
                        alert("Please select a plane that this activity be done on!");
                    }

                break;

            }



        }


        $scope.remove_item = function(type, index){
            //console.log("REMOVE");

            vm.club.item.planes.splice(index, 1);


            // switch(type){
            //     case "plane":
            //             //console.log("plane");
                   
            //             //check if it doesnt exist first...
            //             // if(containsObject(add_licence, vm.club.plane.requirements.licence, new Array("licence_id", "rating_id")) == false){
            //             //     vm.club.plane.requirements.licence.push(add_licence);
            //             // }

            //             vm.club.item.planes.splice(index, 1);
                      
            //     break;
            // }


            //     case "medical":
            //         //console.log("medical");
            //         if(vm.temporary.medical_authority && vm.temporary.medical_authority !== "" && vm.temporary.medical_component && vm.temporary.medical_component !== ""){
            //             //then we can add it
            //             //console.log("here we go");
            //             var add_medical = {
            //                 authority_id: vm.temporary.medical_authority.id,
            //                 authority_title: vm.temporary.medical_authority.abbreviation,
            //                 medical_component_id: vm.temporary.medical_component.id,
            //                 medical_component_title: vm.temporary.medical_component.title
            //             };

            //             //check if it doesnt exist first...
            //             if(containsObject(add_medical, vm.club.plane.requirements.medical, new Array("authority_id", "medical_component_id")) == false){
            //                 vm.club.plane.requirements.medical.push(add_medical);
            //             }

            //             delete vm.temporary.medical_authority;
            //             delete vm.temporary.medical_component;

            //         } else {
            //             alert("Please select a medical that is required to book the plane solo!");
            //         }

            //     break;


            //     case "differences":
            //         //console.log("difference");
            //         if(vm.temporary.difference && vm.temporary.difference !== ""){
            //             //then we can add it
            //             //console.log("here we go");
            //             var add_difference = {
            //                 difference_id: vm.temporary.difference.id,
            //                 difference_title: vm.temporary.difference.title
            //             };

            //             //check if it doesnt exist first...
            //             if(containsObject(add_difference, vm.club.plane.requirements.differences, new Array("difference_id", "difference_title")) == false){
            //                 vm.club.plane.requirements.differences.push(add_difference);
            //             }

            //             delete vm.temporary.difference;

            //         } else {
            //             alert("Please select a difference that is required to book the plane solo!");
            //         }

            //     break;


            // }



        }
















        $scope.update_this_file = function(file){
            //console.log("==== update is : ", file.id);
            if(update_this_file.indexOf(file.id) === -1){
                update_this_file.push(file.id)
            } else {
               ////console.log("This item already exists"); 
            } 
        }


         $scope.remove_real_file = function(file){

                //remove_file

                vm.club.plane.plane_documents = $.grep(vm.club.plane.plane_documents, function(e){ 
                        return e.id != file.id; 
                    });

                //no need to actually remove the file as it will be archived accordingly on the backend whilst it is missing! :)
                PlaneDocumentService.Delete(vm.user.id, file.id)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.plane_documents = [];
                        //and re-process available files
                        $scope.processFiles(current_files);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

          }


          
          $scope.remove_file = function(file, current_files){

            //remove_file
            var j = JSON.parse(file.file_return);
            //console.log("REMOVE: ", j);
            //console.log("REMOVE: ", j.saved_url);

            //to delete the temp file created: j.saved_url
            //tmp_rm.php POST tmp = filename
            
            PoidService.DeleteTmp(j.saved_url)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.plane_documents = [];
                        //and re-process available files
                        $scope.processFiles(current_files);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

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