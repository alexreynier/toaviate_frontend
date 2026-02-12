 app.controller('RefundModalInstanceCtrl', RefundModalInstanceCtrl);

    RefundModalInstanceCtrl.$inject = ['$scope', '$uibModalInstance', 'id', 'warning', 'params', 'ToastService'];
    function RefundModalInstanceCtrl($scope, $uibModalInstance, id, warning, params=null, ToastService) {         

            $scope.warning = warning;
            $scope.params = params;
            //console.log("APARAMS", params);

            $scope.to_refund = 0;
            $scope.reason = "";
            $scope.remaining = (params.amount - params.amount_refunded);



          $scope.ok = function () {
            if (!$scope.to_refund || $scope.to_refund <= 0) {
                ToastService.error('Missing: Refund Amount', 'Please enter an amount greater than zero to refund.');
                var el = document.querySelector('input[name="refund_amount"]');
                if (el) { el.classList.add('field-error-highlight'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
                return;
            }
            if ($scope.to_refund > $scope.remaining) {
                ToastService.error('Invalid Amount', 'The refund amount cannot exceed £' + $scope.remaining + '.');
                return;
            }
            if (!$scope.reason || !$scope.reason.trim()) {
                ToastService.error('Missing: Reason', 'Please provide a reason for this refund.');
                return;
            }
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