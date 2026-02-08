app.controller('ImagesController', ImagesController);
 
    ImagesController.$inject = ['UserService', 'ArtpiecesService', 'ImagesService', 'KeywordsService', 'CategoryService', '$location', '$rootScope', 'FlashService', '$routeParams', '$scope', 'LocalDataService'];
    function ImagesController(UserService, ArtpiecesService, ImagesService, KeywordsService, CategoryService, $location, $rootScope, FlashService, $routeParams, $scope, LocalDataService) {
        var vm = this;
        $scope.filters = "";
        vm.selected_images = [];


         ImagesService.GetAll()
                .then(function (data) {
                    vm.images = data;
                });

          ArtpiecesService.GetAll()
                .then(function(data){
                    vm.all_artpieces = data;
                    vm.artpieces = data;
                });

         CategoryService.GetAll()
                .then(function(data){
                    vm.categories = data;
                });


        //get one?
        if($routeParams.imageId){
            ImagesService.GetOne($routeParams.imageId)
                    .then(function (data) {
                        vm.one_image = data;
                        //console.log(vm.one_image);

                        //console.log(vm.one_image.keywords);
                        //console.log(vm.one_image.keywords[0]);
                        //console.log(vm.one_image.keywords[0].id);

                        //converting the keywords to the appropriate format for the front-end
                        var tags = [];
                        vm.one_image.keywords.forEach(function(data){
                            tags.push({id: data.id, text: data.keyword});
                        });
                        //console.log(tags);
                        $scope.tags = tags;      

                    });
        }


         KeywordsService.GetAll()
                .then(function (data) {
                    vm.all_keywords = data;
                    //console.log(vm.all_keywords);
                    vm.all_tags = [];
                    vm.all_keywords.forEach(function(data){
                        vm.all_tags.push({id: data.id, text: data.keyword});
                    });
                });


        var init = function(){
            setTimeout(function(){
                vm.selected_images = LocalDataService.data.selected_images;
                //console.log("RUN ME");
                var select
                if(vm.selected_images.length > 0){
                    //console.log("checking");
                    vm.selected_images.forEach(function(image){
                        //console.log("foreach");
                        if(image.selected == 1){
                            //well its selected - so we deselect right?

                             //vm.selected_images.push(image);
                            update_selected_state(image.id, true);

                           
                        } else {
                            update_selected_state(image.id, false);
                            vm.selected_images = $.grep(vm.selected_images, function(e){ 
                                return e.id != image.id; 
                            });
                        }
                    });
                }
            }, 500);
        }


        //action on the isotope bit
        var update_image_list = function(){
            var get_tags = $scope.tags;
            var filtering = $scope.filters;
            //console.log("FILTERING BIT");
            //console.log(filtering);
            if(filtering && filtering.indexOf(", ")){
                var filter_array = filtering.split(", ");
                filtering = "";
                var multi_level_filter = [];
                filter_array.forEach(function(data){
                    var loop_content = data;
                    if(get_tags){
                         get_tags.forEach(function(data){
                            loop_content += "."+data.text;
                        });
                    }
                    multi_level_filter.push(loop_content);
                });
                //console.log(multi_level_filter);
                //console.log("ABOVE");
                filtering = multi_level_filter.join(", ");
            } else {
                if(get_tags){
                     get_tags.forEach(function(data){
                        filtering += "."+data.text;
                    });
                }
            }
            //console.log(filtering);
            $scope.$emit('iso-option', {filter: filtering});
        }

        var current_category = 0;

        $scope.change_category = function(index){
            //console.log("LOADING INDEX : "+index);
            current_category = index;
            if(index == "all"){
                //console.log("SHOW ALL HERE PLEASE");
                vm.artpieces = vm.all_artpieces;
                $scope.filters = "";
                update_image_list();
            } else {
                vm.artpieces = (vm.categories[index].artpieces) ? vm.categories[index].artpieces : [];
                if(vm.categories[index].artpieces && vm.categories[index].artpieces.length > 0){
                    var all = vm.categories[index].artpieces;
                    var artpieces_array = [];
                    all.forEach(function(data){
                        artpieces_array.push(".artpiece"+data.id);
                    });
                    $scope.filters = artpieces_array.join(", ");
                    update_image_list();
                    return $scope.filters;
                } else {
                    $scope.filters = ".hideAllPossibleItems";
                    update_image_list();
                }
            }
        }

        // filter by actpiece here :)
        $scope.artpiece_filter = function(filter){
            $scope.filters = (filter == "all") ? ( (current_category == 0) ? "" : $scope.change_category(current_category) ) : ".artpiece"+filter;
            update_image_list();
        }        

        //filter by image keyword
        $scope.update_list = function(){
            // 500ms delay due to not ready state called occasionally...
            setTimeout(function(){
                //console.log($scope.tags);
                //this is when isotope should be called
                //filter tag WITH all in tags 
                update_image_list();
            }, 500);
        }



        //testing the requirements bit
        // $scope.shuffle = function(){
        //     var get_tags = $scope.tags;
        //     var filtering = "";
        //     get_tags.forEach(function(data){
        //         filtering += "."+data.text;
        //     });
        //     $scope.$emit('iso-option', {filter: filtering});
        // }

        var update_selected_state = function(id, state){
            for(var i = 0; i < vm.images.length; i++) {
                if (vm.images[i].id === id) {
                    vm.images[i].selected = state;
                }
            }
        }


        //this is where we do the selection of images
        $scope.add_image = function(image){
            //check if set selected
            if(image.selected == 1){
                //well its selected - so we deselect right?
                update_selected_state(image.id, false);
                vm.selected_images = $.grep(vm.selected_images, function(e){ 
                    return e.id != image.id; 
                });
            } else {
                vm.selected_images.push(image);
                update_selected_state(image.id, true);
            }
            //console.log(vm.selected_images);
            LocalDataService.SetSelectedImages(vm.selected_images);
        }

        vm.save_btn_text = (LocalDataService.data.selecting_for > 0) ? "UPDATE GALLERY" : "GENERATE GALLERY";

        $scope.save = function(){
            //console.log(LocalDataService.data.selected_images);
            var url_save = (LocalDataService.data.selecting_for > 0) ? "/galleries" : "/create_gallery";
            $location.path(url_save);
        }

       

        $scope.editImage = function(){
            //compile all content :::
            vm.one_image.keywords = $scope.tags;
            ImagesService.Update(vm.one_image)
                .then(function (data) {
                     $location.path("/images");
                     vm.one_image = {};
                });
        }

        $scope.loadClasses = function(classes){
            // var arr = [];
            //console.log(classes);
            return "one two three";

        }

        $scope.loadTags = function(query) {

            var first = $.grep(vm.all_keywords, function(e){ var ab = e.keyword; var ab = ab.toLowerCase(); if(ab.startsWith(query.toLowerCase())){ return true; } });
            var second = [];
            for(var i = 0; i < first.length; i++){
                var text_to_lower = first[i].keyword;
                text_to_lower = text_to_lower.toLowerCase();
                second.push({id: first[i].id, text: text_to_lower});
            }
            return second;

        };


		$scope.deleteImage = function(id){
			ImagesService.Delete(id)
                .then(function (data) {
                    vm.images = $.grep(vm.images, function(e){ 
					     return e.id != id; 
					});
                });
		}

        init();

    }