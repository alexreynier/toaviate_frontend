 app.controller('ModalInstanceCtrl', ModalInstanceCtrl);

    ModalInstanceCtrl.$inject = ['$scope', '$uibModalInstance', 'id', 'warning', 'params'];
    function ModalInstanceCtrl($scope, $uibModalInstance, id, warning, params=null) {         

            $scope.warning = warning;
            $scope.params = params;
            $scope.images = params.images;
            //console.log("APARAMS", params);

          $scope.ok = function () {
            $uibModalInstance.close(params);
          };

          $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
          };

          $scope.params = function(params){
            return params;
          }


    }