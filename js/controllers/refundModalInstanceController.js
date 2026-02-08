 app.controller('RefundModalInstanceCtrl', RefundModalInstanceCtrl);

    RefundModalInstanceCtrl.$inject = ['$scope', '$uibModalInstance', 'id', 'warning', 'params'];
    function RefundModalInstanceCtrl($scope, $uibModalInstance, id, warning, params=null) {         

            $scope.warning = warning;
            $scope.params = params;
            //console.log("APARAMS", params);

            $scope.to_refund = 0;
            $scope.reason = "";
            $scope.remaining = (params.amount - params.amount_refunded);



          $scope.ok = function () {
            var obj = params;
            obj.reason = $scope.reason;
            obj.to_refund = $scope.to_refund
            $uibModalInstance.close(obj);
          };

          $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
          };

          $scope.params = function(params){
            return params;
          }


    }