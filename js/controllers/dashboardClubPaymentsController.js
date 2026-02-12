 app.controller('DashboardClubPaymentsController', DashboardClubPaymentsController);

    DashboardClubPaymentsController.$inject = ['UserService', 'PlaneService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'LicenceService', 'MedicalService', 'DifferencesService', 'PlaneDocumentService', 'ClubPaymentService', 'ToastService'];
    function DashboardClubPaymentsController(UserService, PlaneService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, LicenceService, MedicalService, DifferencesService, PlaneDocumentService, ClubPaymentService, ToastService) {
        var vm = this;

        vm.user = null;
        vm.allUsers = [];
        vm.club = {
            plane: {
                requirements: {
                    licence: [],
                    medical: [],
                    differences: []
                },
                documents: []
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

        ClubPaymentService.GetPaymentsByClub(vm.club_id)
                .then(function(data){
                    //console.log("ALL PAYMENTS...", data);
                    vm.payments = data.payments;
                });

        //'9' needs to refer the the user's account set to manage
       
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
            vm.club.plane.club_id = vm.club_id;
            vm.club.plane.add_documents = vm.plane_documents;
            //console.log("PLANE TO ADD, ", vm.club.plane);
            //return false;
            PlaneService.Create(vm.club.plane)
                .then(function(data){
                    //console.log(data);
                    $state.go('dashboard.manage_club.planes', {reload: true});

                });
        }

        $scope.delete = function(){
            //console.log("CLICK");
            ToastService.warning('Delete Plane', 'Are you sure you would like to delete this plane?');
            PlaneService.Update(vm.club.plane)
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
            vm.club.plane.club_id = vm.club_id;
            vm.club.plane.add_documents = vm.plane_documents;

            vm.club.plane.update_documents = get_update_docs();
            //get_update_docs();

            PlaneService.Update(vm.club.plane)
                .then(function(data){
                    //console.log(data);
                    //console.log("saved");
                    $state.go('dashboard.manage_club.planes');
                });
        }

        $scope.get_payment_description = function(payment_method){

            if(payment_method == "Stripe"){
                return "This invoice was charged using the Stripe integration";
            } else if(payment_method == "Equilibrium"){
                return "This invoice amounted to £0 and hence no payment was taken";
            } else if(payment_method == "GoCardless"){
                return "This invoice was charged using the GoCardless integration";
            } else if(payment_method == "GoCardless + Credit"){
                return "This invoice was charged using the GoCardless integration as well as Credit on file.";
            } else if(payment_method == "Credit"){
                return "This invoice was charged using the Credit the user had on file.";
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
           //console.log("check if access is okay");
        }


          var warning_msg = "By deleting this plane, you will also cancel all reservations that this plane currently has."


            $scope.open = function (payment) {
            var modalInstance = $uibModal.open({
              animation: true,
              templateUrl: 'views/modals/refundModal.html',
              controller: 'RefundModalInstanceCtrl',
              size: "lg",
              resolve: {
                id: function () {
                  return payment;
                },
                params: function() {
                  return payment;
                },
                warning: function(){
                    return warning_msg;
                }
              }
            });
            modalInstance.result.then(function (refund) {
                var id = refund.id;
              $log.info('PRESSED GO: ', refund);
              
              if(refund.to_refund > (refund.amount - refund.amount_refunded)){
                ToastService.warning('Refund Limit', 'You are trying to refund more than the payment was for. You will need to first refund this amount in full, and then make a payment to the user for the remaining sum.');
                return false;
              }

              if(refund.to_refund > 0 && refund.payment_method == "Stripe"){
                //then the amount is OK to refund....
                //and this is a Stripe payment.

                if(refund.to_refund == refund.amount){
                    //total refund

                } else {
                    //partial refund

                }

                ClubPaymentService.Refund(refund)
                .then(function(data){
                    //console.log("HELLO REFUND", data);
                    //update view?
                    

                 });




              }


             //  PlaneService.Delete(id)
             //  .then(function(){
             //    //console.log("HELLO DELETE");
             //    //update view?
             //     vm.club.planes = $.grep(vm.club.planes, function(e){ 
             //        return e.id != id; 
             //    });
             // });

            }, function () {
              $log.info('Modal dismissed at: ' + new Date());
            });


          };










          $scope.new_charge = function (charge) {
            var modalInstance = $uibModal.open({
              animation: true,
              templateUrl: 'views/modals/newChargeModal.html',
              controller: 'NewChargeModalInstanceCtrl',
              size: "lg",
              resolve: {
                id: function () {
                  return charge;
                },
                params: function() {
                  return charge;
                },
                warning: function(){
                    return warning_msg;
                }
              }
            });
            modalInstance.result.then(function (charge) {
               

              $log.info('PRESSED GO: ', charge);
              
                

                // ClubPaymentService.Refund(refund)
                // .then(function(data){
                //     //console.log("HELLO REFUND", data);
                //     //update view?
                    

                //  });




            }, function () {
              $log.info('Modal dismissed at: ' + new Date());
            });


          };
         


    }