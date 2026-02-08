app.controller('UploadController', UploadController);
 
    UploadController.$inject = ['KeywordsService', 'ArtpiecesService', 'ImageUploadService', '$scope', '$http', '$location'];
    function UploadController(KeywordsService, ArtpiecesService, ImageUploadService, $scope, $http, $location) {
            


        var vm = this;
        
        //current tags
        $scope.tags = [];

        KeywordsService.GetAll()
                .then(function (data) {
                    vm.all_keywords = data;
                    //console.log(vm.all_keywords);
                });

        ArtpiecesService.GetAll()
                .then(function(data){
                    vm.artpieces = data;
                });
        
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

          $scope.CheckData = function(content){
            // //console.log("BELOW");
            // //console.log(content);
            var images_array = [];
            var images = content; //JSON.parse(content.file_return);
            for(var i = 0; i < images.length; i++){
                //var image = JSON.parse(images[i].f);
                // //console.log("file_return"+images[i].file_return);
                var image = images[i].file_return;
                var image = JSON.parse(image);
                // //console.log(image.files.file.tmp_name);
                images_array.push(image.files.file.tmp_name);
            }
            // //console.log(content.file_return);
            // //console.log(images_array); // all the images
            // //console.log($scope.tags); //all the tags objects
            // //console.log(vm.artme); //this is the artpiece id
            var compiled_send = {
                images: images_array,
                keywords: $scope.tags,
                artpiece_id: vm.artme
            };

            //console.log(compiled_send);

            ImageUploadService.Create(compiled_send)
                .then(function(data){
                    //console.log(data);
                    $location.path("/");
                });


          }
         
       

    }