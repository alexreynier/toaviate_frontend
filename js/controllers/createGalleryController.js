app.controller('CreateGalleryController', CreateGalleryController);
 
    CreateGalleryController.$inject = ['UserService', 'ArtpiecesService', 'ImagesService', 'KeywordsService', 'CategoryService', '$location', '$rootScope', 'FlashService', '$routeParams', '$scope', 'LocalDataService', 'GalleryService'];
    function CreateGalleryController(UserService, ArtpiecesService, ImagesService, KeywordsService, CategoryService, $location, $rootScope, FlashService, $routeParams, $scope, LocalDataService, GalleryService) {
        var vm = this;

        vm.gallery = {
            is_protected: "false",
            download_low: "false",
            download_medium: "false",
            download_high: "false",
            gallery_link: "",
            fullscreen: "false"
        };

        //get all galleries to check if name is already in use...
        GalleryService.GetAll()
                .then(function(data){
                     vm.all_galleries = data;
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


        $scope.generate_gallery = function(){
            //console.log("CLICKED GALLERY BIT");
            //console.log(LocalDataService.data.selected_images);
            //we need to set the ORDER as organise in the vm.images
            var organise = 0;
            for(var i = 0; i < vm.images.length; i++){
                vm.images[i].organise = i;
            }
            //console.log("ORGANISE BELOW?");
            //console.log(vm.images);

            vm.gallery.images = vm.images;
            //console.log(vm.gallery);
            GalleryService.Create(vm.gallery)
                .then(function(data){
                    //console.log(data);
                    $location.path("/gallery/"+data.gallery_link);
                });
        }

       



    }