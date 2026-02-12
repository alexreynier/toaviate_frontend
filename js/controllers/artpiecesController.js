app.controller('ArtpiecesController', ArtpiecesController);
 
    ArtpiecesController.$inject = ['UserService', 'CategoryService', 'ArtpiecesService', '$location', '$rootScope', 'FlashService', '$routeParams', '$scope', 'ToastService'];
    function ArtpiecesController(UserService, CategoryService, ArtpiecesService, $location, $rootScope, FlashService, $routeParams, $scope, ToastService) {
        var vm = this;
        vm.artpiece = {};
        vm.artpiece.categories = [];


        //for the VIEW page

        CategoryService.GetAll()
                .then(function (data) {
                    vm.categories = data;

                    //If we are loading the edit page - let's get specific information that may be useful for the update! :-)
                    if($routeParams.artpieceId !== ""){
                    	//for the edit page -- get the one
						ArtpiecesService.GetById($routeParams.artpieceId)
				        		.then(function (data){
				        			vm.artpiece = data;
				        			if(vm.artpiece.categories){
					        			//console.log(vm.artpiece.categories);
					        			// vm.artpiece.categories = JSON.parse(vm.artpiece.categories);
					        			//console.log("FOR");
					        			for(var i = 0; i < vm.artpiece.categories.length; i++){
					        				//console.log("BOO");
					        				//console.log(vm.artpiece.categories[i]);
					        				//remove from the dropdown the items already in the project
					        				vm.categories = $.grep(vm.categories, function(e){ 
												return e.id != vm.artpiece.categories[i]["category_id"]; 
											});
					        			
					        			}
					        		}
				        		});
                    }

                });

        ArtpiecesService.GetAll()
        		.then(function (data){
        			vm.artpieces = data;
        		});

       
		$scope.tempAddCategory = function(data){
			var category = JSON.parse(data);
			//console.log('add category_id : '+category.id);
			vm.artpiece.categories.push(category);
			//updating the select dropdown
			vm.categories = $.grep(vm.categories, function(e){ 
				return e.id != category.id; 
			});
		}

		$scope.tempDeleteCategory = function(cat){
			vm.artpiece.categories = $.grep(vm.artpiece.categories, function(e){ 
					     return e.id != cat.id; 
					});
			vm.categories.push(cat);
		}

		$scope.AddCategory = function(data){

			var category = JSON.parse(data);
			//console.log('add category_id : '+category.id);

			ArtpiecesService.AddCategory( {"category_id": category.id, "artpiece_id": vm.artpiece.id} )
        		.then(function (data){
        		
					vm.artpiece.categories.push(category);
					//updating the select dropdown
					vm.categories = $.grep(vm.categories, function(e){ 
						return e.id != category.id; 
					});
			});

		}

		$scope.DeleteCategory = function(category){
			//console.log(category);
			ArtpiecesService.DeleteCategory({"category_id": category.category_id, "artpiece_id": vm.artpiece.id})
        		.then(function (data){
					vm.artpiece.categories = $.grep(vm.artpiece.categories, function(e){ 
					     return e.id != category.id;
					});
					vm.categories.push(category);
				});

		}

		$scope.addArtpiece = function(){
			// ── Pre-submit validation ──
			if (!vm.artpiece.title || vm.artpiece.title.trim() === '') {
				ToastService.highlightField('artpiece_title');
				ToastService.warning('Title Required', 'Please enter a title for the artpiece.');
				return;
			}
			ArtpiecesService.Create(vm.artpiece)
                .then(function (data) {
                    if (data.success !== false) {
                        ToastService.success('Artpiece Created', 'Your artpiece has been added.');
                        $location.path("/artpieces");
                        vm.artpiece = {};
                    } else {
                        ToastService.error('Create Failed', data.message || 'Something went wrong.');
                    }
                });
		}

		$scope.editArtpiece = function(){
			if (!vm.artpiece.title || vm.artpiece.title.trim() === '') {
				ToastService.highlightField('artpiece_title');
				ToastService.warning('Title Required', 'Please enter a title for the artpiece.');
				return;
			}
			ArtpiecesService.Update(vm.artpiece)
                .then(function (data) {
                    if (data.success !== false) {
                        ToastService.success('Artpiece Updated', 'Your changes have been saved.');
                        $location.path("/artpieces");
                        vm.artpiece = {};
                    } else {
                        ToastService.error('Update Failed', data.message || 'Something went wrong.');
                    }
                });
		}

		$scope.deleteArtpiece = function(id){
			//console.log("GET HERE "+id);
			ArtpiecesService.Delete(id)
                .then(function (data) {
                    vm.artpieces = $.grep(vm.artpieces, function(e){ 
					     return e.id != id; 
					});
                });
		}

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





        //update on edit?
  //      	vm.myModel = 'Click here and delete me';
		// $scope.myUpdateHandler = function(id, category){
		//   // check your console
		//   //console.log('value of '+id+' your model is now: ' + category);
		//   var update = {"id": id, "title": category};
		//   CategoryService.Update(update)
  //               .then(function (data) {
  //                   //console.log("SAVED :)");
  //               });
		// };

    }