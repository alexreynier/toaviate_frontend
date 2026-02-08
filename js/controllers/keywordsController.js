app.controller('KeywordsController', KeywordsController);
 
    KeywordsController.$inject = ['UserService', 'KeywordsService', '$location', '$rootScope', 'FlashService', '$routeParams', '$scope'];
    function KeywordsController(UserService, KeywordsService, $location, $rootScope, FlashService, $routeParams, $scope) {
        var vm = this;

         KeywordsService.GetAll()
                .then(function (data) {
                    vm.keywords = data;
                });

       	vm.id = 1;
       	vm.myModel = 'Click here and delete me';
		$scope.myUpdateHandler = function(id, keyword){
		  // check your console
		  //console.log('value of '+id+' your model is now: ' + keyword);
		  var update = {"id": id, "keyword": keyword};
		  KeywordsService.Update(update)
                .then(function (data) {
                    //console.log("SAVED :)");
                });
		};

		$scope.addKeyword = function(){
			//console.log("ADD ONE "+vm.new_keyword);
			//need to call the outside world here and now :0
			var add_one = {"keyword": vm.new_keyword};
			KeywordsService.Create(add_one)
                .then(function (data) {
                    vm.keywords.push(data);
                    //reset
					vm.new_keyword = "";
                });
		}

		$scope.deleteKeyword = function(id){

			KeywordsService.Delete(id)
                .then(function (data) {

                    vm.keywords = $.grep(vm.keywords, function(e){ 
					     return e.id != id; 
					});

                });
		}

    }