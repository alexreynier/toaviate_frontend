app.controller('ShowGalleryController', ShowGalleryController);
 
    ShowGalleryController.$inject = ['UserService', 'ArtpiecesService', 'ImagesService', 'KeywordsService', 'CategoryService', '$location', '$rootScope', 'FlashService', '$routeParams', '$scope', 'LocalDataService', 'GalleryService'];
    function ShowGalleryController(UserService, ArtpiecesService, ImagesService, KeywordsService, CategoryService, $location, $rootScope, FlashService, $routeParams, $scope, LocalDataService, GalleryService) {
        var vm = this;

        vm.gallery = {
            is_protected: "false",
            download_low: "false",
            download_medium: "false",
            download_high: "false",
            gallery_link: "",
            fullscreen: "false"
        };

        vm.current = {
            image: {
                link: "",
                description: "hi"
            },
            artpiece: {
                title: "",
                description: ""
            },
            index: 0
        };

        //get all galleries to check if name is already in use...
        GalleryService.GetByUrl({gallery_link: $routeParams.gallery_link})
                .then(function(data){
                    //console.log(data);
                     vm.gallery = data;
                     //routeParams
                     if(data.images.length > 0){
                        if(data.is_disabled == "true"){
                            //console.log("ERROR disabled");
                            $location.path("/disabled");
                        }

                        //console.log("HELLO");
                        //console.log(vm.gallery.is_disabled);
                        vm.current.image.link = vm.gallery.images[0].link;
                        vm.current.image.description = vm.gallery.images[0].description;
                        vm.current.artpiece.title = vm.gallery.images[0].artpiece.title;
                        vm.current.artpiece.description = vm.gallery.images[0].artpiece.description;
                        vm.current.index = 0;
                    } else {
                            //console.log("Couldn't find the page");
                            $location.path("/disabled");
                    }


                });



        $scope.login = function(){
            if(vm.password_protected == vm.gallery.password){
                //console.log("YAY");
                vm.gallery.is_protected = "false";
            } else {
                //console.log("FAIL");
                return false;
            }
        }

        var load_image = function(index){
            // $(".show_gallery_big_image img").removeClass("ng-hide-add");
            // $(".show_gallery_big_image img").addClass("ng-hide-remove");
            vm.current.image.link = vm.gallery.images[index].link;
            vm.current.image.description = vm.gallery.images[index].description;
            vm.current.artpiece.title = vm.gallery.images[index].artpiece.title;
            vm.current.artpiece.description = vm.gallery.images[index].artpiece.description;
            vm.current.index = index;
           
        }

        $scope.change_image = function(index){
            load_image(index);
        }

        $scope.show_fullscreen = function(){
            $("#fullscreen").fadeIn();
            $("p.viewport").hide();
        }

        $scope.hide_fullscreen = function(){
            $("#fullscreen").fadeOut();
            $("p.viewport").show();

        }

        $scope.fullscreen_next = function(){
            var next = vm.current.index + 1;
            if(next > (vm.gallery.images.length - 1)){ next = 0; } 
            //load the next one
            load_image(next);
        }

        $scope.fullscreen_previous = function(){
            var prev = vm.current.index - 1;
            if(prev < 0){ prev = (vm.gallery.images.length - 1); } 
            //load the next one
            load_image(prev);
        }

        $scope.download = function(value){
            //download low / medium / high definition image ZIP
            GalleryService.DownloadZip({gallery_id: vm.gallery.id, quality: value})
                            .then(function(data){
                                //console.log(data);
                                    var link = document.createElement("a");
                                    link.download = data.zip_url;
                                    link.href = data.zip_url;
                                    link.click();
                            });

            //window.saveAs(blob, filename) ? WTF?
        }

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
                    //$location.path("/gallery/"+data.link);
                });
        }

       



    }