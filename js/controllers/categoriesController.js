app.controller('CategoriesController', CategoriesController);
 
    CategoriesController.$inject = ['UserService', 'CategoryService', '$location', '$rootScope', 'FlashService', '$routeParams', '$scope'];
    function CategoriesController(UserService, CategoryService, $location, $rootScope, FlashService, $routeParams, $scope) {
        var vm = this;

        // vm.cats = [
        // 	{"title": "art", "id": 1},
        // 	{"title": "fashion", "id": 2},
        // 	{"title": "glass", "id": 3},
        // 	{"title": "metal", "id": 4}
        // ];
       
         CategoryService.GetAll()
                .then(function (data) {
                    vm.cats = data;
                });

       	vm.id = 1;
       	vm.myModel = 'Click here and delete me';
		$scope.myUpdateHandler = function(id, category){
		  // check your console
		  //console.log('value of '+id+' your model is now: ' + category);
		  var update = {"id": id, "title": category};
		  CategoryService.Update(update)
                .then(function (data) {
                    //console.log("SAVED :)");
                });
		};

		$scope.addCategory = function(){
			//console.log("ADD ONE "+vm.new_category);
			//need to call the outside world here and now :0
			var add_one = {"title": vm.new_category};
			CategoryService.Create(add_one)
                .then(function (data) {
                    vm.cats.push(data);
                    //reset
					vm.new_category = "";
                });
		}

		$scope.deleteCategory = function(id){

			CategoryService.Delete(id)
                .then(function (data) {
                    vm.cats = $.grep(vm.cats, function(e){ 
					     return e.id != id; 
					});
                });

		}

    }