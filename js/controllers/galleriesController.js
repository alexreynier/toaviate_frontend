app.controller('GalleriesController', GalleriesController);
 
    GalleriesController.$inject = ['UserService', 'ArtpiecesService', 'ImagesService', 'KeywordsService', 'CategoryService', '$location', '$rootScope', 'FlashService', '$routeParams', '$scope', 'LocalDataService', 'GalleryService'];
    function GalleriesController(UserService, ArtpiecesService, ImagesService, KeywordsService, CategoryService, $location, $rootScope, FlashService, $routeParams, $scope, LocalDataService, GalleryService) {
        var vm = this;

      

        //get all galleries to check if name is already in use...
        GalleryService.GetAll()
                .then(function(data){
                     vm.galleries = data;
                     LocalDataService.SetAllGalleries(data);
                     if(LocalDataService.data.selecting_for > 0){
                        vm.galleries.forEach(function(data){
                            if(data.id == LocalDataService.data.selecting_for){
                                data.images = LocalDataService.data.selected_images;
                            }
                        });
                        $("#organise_images").fadeIn();
                        //maybe we need to update the state of the SAVE button as it hasn't been saved yet?
                     } else {
                        //nothin to do?
                     }
                });



        vm.images = LocalDataService.data.selected_images;

        //this is where we do the selection of images
        $scope.remove_image = function(image){
            //check if set selected
            //well its selected - so we deselect right?
            vm.images = $.grep(vm.images, function(e){ 
                return e.id != image.id; 
            });
            //console.log(vm.images);
            LocalDataService.SetSelectedImages(vm.images);
        }

        $scope.check_link_unique = function(){
            for(var i = 0; i < vm.all_galleries.length; i++){
                if(vm.all_galleries[i].link===vm.gallery.link){
                    return false;
                }
            }
        }

        $scope.edit_gallery_images = function(index){
             var gallery = vm.galleries[index];
             for(var i=0; i < gallery.images.length; i++){
                gallery.images[i].selected = true;
             }
            LocalDataService.SetSelectedImages(gallery.images);
            LocalDataService.SetSelectingFor(gallery.id);
            //console.log(gallery.images);
            //SetSelectingFor
            $location.path("/select_images");
        }

        $scope.save_images = function(){
            //save images for 
            var images_to_save = [];
            vm.galleries.forEach(function(data){
                if(data.id == LocalDataService.data.selecting_for){
                    data.images = LocalDataService.data.selected_images;
                    for(var i = 0; i < data.images.length; i++){
                        data.images[i].organise = i;
                    }
                    images_to_save = data.images;
                }
            }); 

            //vm.galleries[LocalDataService.data.selecting_for]
            GalleryService.Update({id: LocalDataService.data.selecting_for, images: images_to_save})
                .then(function(data){
                    //console.log(data);
                    LocalDataService.SetSelectingFor(0);
                    $("#organise_images").fadeOut();
                });
           
        }


        $scope.save_gallery = function(index){
           
            var gallery = vm.galleries[index];
            LocalDataService.SetSelectedImages(gallery.images);
            //we need to set the ORDER as organise in the vm.images
            var organise = 0;
            for(var i = 0; i < gallery.images.length; i++){
                gallery.images[i].organise = i;
            }


            GalleryService.Update(vm.galleries[index])
                .then(function(data){
                    //console.log(data);
                    alert("saved");
                    //$location.path("/");
                });
        }

        var check_gallery_link = function(link){
            vm.galleries.forEach(function(data){
                if(data.gallery_link == link){
                    return false;
                }
            });
            return true;
        }

        var generate_gallery_link = function(link){
            var link2 = link + "-COPY";
            if(check_gallery_link(link2)){
                return link2;
            } else {
                return generate_gallery_link(link2+"1");
            }
        }

        $scope.duplicate_gallery = function(index){
            //console.log("INDEX : "+index);
            //HERE BE DRAGONS HORRIBLE HACKY SHIT TO DUPLICATE OBJ
            var new_gallery = JSON.parse(JSON.stringify(vm.galleries[index]));
            //console.log(new_gallery);
            //unset the id to create a new one...
            delete new_gallery.id;
            new_gallery.opened = 0;
            new_gallery.downloaded = 0;
            //console.log(new_gallery);

            new_gallery.gallery_link = generate_gallery_link(new_gallery.gallery_link);

             GalleryService.Create(new_gallery)
                .then(function(data){
                    //console.log(data);
                    vm.galleries.push(data);
                });

        }

        $scope.delete_gallery = function(index){
            //console.log("INDEX : "+index);
            var gallery = vm.galleries[index];
            //console.log(gallery);
            //unset the id to create a new one...
            //console.log(gallery.id);

            GalleryService.Delete(gallery.id)
                .then(function(data){
                    //console.log(data);
                    
                    vm.galleries = $.grep(vm.galleries, function(e){ 
                         return e.id != gallery.id; 
                    });

                });

        }

       



    }