 app.controller('ClubDocumentsController', ClubDocumentsController);

    ClubDocumentsController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'BookingService', 'LicenceService', 'ClubDocumentService', '$http'];
    function ClubDocumentsController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, BookingService, LicenceService, ClubDocumentService, $http) {
        
        var vm = this;
        vm.licence_images = [];
        vm.documents = [];
        vm.licence = {
                images: [],
                ratings: []
        };
        // vm.user_id = 59;
        // vm.club_id = 6;


        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;


        vm.uploaded_document = {};

        //GetByClubId

        // LicenceService.GetLicenceTypes()
        //         .then(function (data) {
        //             vm.licence_types = data;
        //             //console.log("licence_types: ", vm.licence_types);
        //         });

        // LicenceService.GetRatings()
        //     .then(function (data) {
        //         vm.ratings = data;
        //         //console.log("ratings: ", vm.ratings);

        //         if($state.current.data.action == "add"){

        //             vm.selected_rating = $.grep(vm.ratings, function(e){ return e.id == 7; })[0];
        //             $scope.add_rating();

        //             // for(var i=0;i<vm.ratings.length; i++){
        //             //     //console.log("LOOP", vm.ratings[i]);
        //             //     if(vm.ratings[i].id == 7){
        //             //         vm.selected_rating = vm.ratings[i];
        //             //         //console.log("FOUND", vm.selected_rating);
        //             //         $scope.add_rating();
        //             //         break;
        //             //     }
        //             // }
        //         }
               


        //     });

        // LicenceService.GetAuthority()
        //     .then(function (data) {
        //         vm.authority = data;
        //         //console.log("authority: ", vm.authority);
        //     });


        switch($state.current.data.action){
            case "add":

                    //vm.selected_rating = vm.ratings[0];
                    //vm.selected_rating = 
                    

                    // //console.log("AA", vm.selected_rating);

            

            break;
            case "edit":

            // //console.log("EDIT ONE");
            // //console.log("PARAMS: ", $stateParams);

             ClubDocumentService.GetById($stateParams.document_id)
                .then(function (data) {
                    if(data.success){
                        //console.log("WE GOT data", data);
                        vm.document = data.document;
                        vm.uploaded_document = {file: vm.document.document};
                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });



            break;
            case "list":

                //console.log("LIST ALL");

                 //1 get the user's licence...
                 //list stuff

                ClubDocumentService.GetByClubId(vm.club_id)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        vm.club_documents = data.club_documents;

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });


            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  



            $scope.add_rating = function(){

                //remove from first array
                vm.ratings = $.grep(vm.ratings, function(e){ 
                    return e.id != vm.selected_rating.id; 
                });

                vm.licence.ratings.push(vm.selected_rating);

                //clear selected
                delete vm.selected_rating;
                
                //clean the array to show what we want to show :)
                //delete $scope.formData.license.add_to[bit_type];

            }

            $scope.remove_rating = function(index){

                //add to dropdown
                vm.ratings.push(vm.licence.ratings[index]);
                vm.licence.ratings.splice(index,1)

                //$scope.formData.license[bit_type] = $scope.formData.license[bit_type].filter(Boolean);

                //  //console.log($scope.formData.license[bit_type]);
                //  $scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);
            }

            //default add the first rating required...
            



/*

OLD VERSION FOR LEGACY PURPOSES

  $scope.add_element = function(bit_type){

                //remove from first array
                $scope[bit_type][bit_type] = $.grep($scope[bit_type][bit_type], function(e){ 
                    return e.id != $scope.formData.license.add_to[bit_type].id; 
                });

                if(bit_type == "differences"){
                    $scope.formData.license.add_to[bit_type].day = true;
                    $scope.formData.license.add_to[bit_type].vfr = true;
                }
                //console.log($scope.formData.license.add_to[bit_type]);

                $scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);
                
                //clean the array to show what we want to show :)
                delete $scope.formData.license.add_to[bit_type];

            }


            $scope.remove_element = function(bit_type, index){

                //add to dropdown
                $scope[bit_type][bit_type].push($scope.formData.license[bit_type][index]);
            
                $scope.formData.license[bit_type].splice(index,1)

                $scope.formData.license[bit_type] = $scope.formData.license[bit_type].filter(Boolean);
                //console.log($scope.formData.license[bit_type]);
                //$scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);
            }


*/


            //nice looking date pickers


            $scope.popup = [];

            $scope.open = function(id, $event) {
                //console.log("THIS", id);
                //this comment would allow the event not to be affect by clicking it again... not sure this is a good idea
                if($scope.popup[id] && $scope.popup[id].opened == true){
                    $event.preventDefault();
                    $event.stopPropagation();
                } else {
                    $scope.popup[id] = {opened: true};
                }
            };

            $scope.formats = ['dd/MM/yyyy', 'yyyy/MM/dd', 'dd.MM.yyyy', 'shortDate'];
            $scope.format = $scope.formats[0];

            $scope.datePickerOptions = {
                                        format: 'dd/MM/yyyy',
                                        showWeeks: false
                                    };

           

          //  $scope.remove_real_file = function(file){

          //       //remove_file

          //       vm.licence.images = $.grep(vm.licence.images, function(e){ 
          //               return e.id != file.id; 
          //           });

          //       //no need to actually remove the file as it will be archived accordingly on the backend whilst it is missing! :)
                

          // }


          
          $scope.remove_file = function(file, current_files){

            //remove_file
            var j = JSON.parse(file.file_return);
            //console.log("REMOVE: ", j);
            //console.log("REMOVE: ", j.saved_url);

            //to delete the temp file created: j.saved_url
            //tmp_rm.php POST tmp = filename
            
            LicenceService.DeleteTmp(j.saved_url)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.licence_images = [];
                        //and re-process available files
                        $scope.processFiles(current_files);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

          }
          

            // $scope.processFiles = function(files){
            //     // //console.log("files", files);

            //     for(var i=0; i<files.length; i++){
            //         // //console.log("JSON", files[i].file_return);
            //         var j = JSON.parse(files[i].file_return);
            //         // //console.log("PARSED", j);
            //         files[i].file.temp_path = j.saved_url;
            //         // //console.log("file", files[i].file);
            //         vm.documents.push(files[i].file);
            //     }
               
            // }
            $scope.processFiles = function(files){
                // //console.log("files", files);

                for(var i=0; i<files.length; i++){
                    // //console.log("JSON", files[i].file_return);
                    var j = JSON.parse(files[i].file_return);
                    // //console.log("PARSED", j);
                    //console.log("J is : ",j);
                    //console.log("name is : ", j.files.file.name);

                    files[i].file.temp_path = j.saved_url;
                    files[i].file.save_name = j.files.file.name;
                    var ft = j.files.file.name;
                    ft = ft.split('.').pop();
                    files[i].file.extension = ft;

                    // //console.log("file", files[i].file);
                    vm.documents.push(files[i].file);
                }


            }



            $scope.delete_licence = function(id){


                var a = prompt("Are you sure you wish to delete this licence? \n\n This change is irreversible! To confirm please type YES in the box below.");
                if(a == "YES"){
                    //console.log("WE DELETE IT");


                    ClubDocumentService.Delete(vm.user_id, id)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                vm.club_documents = $.grep(vm.club_documents, function(e){ 
                                    return e.id != id; 
                                });
                                
                                //refresh?
                                $state.reload();
                                $state.go('dashboard.manage_club.documents');

                            } else {

                                alert("Something went terribly wrong... \n\n "+data.message);

                            }

                        });



                } else {
                    //console.log("ignore");
                }


            }




            $scope.save_licence = function(isValid){
                //console.log("HERE ALEX", vm.document);
                if(vm.documents.length < 1 && vm.document.document == ""){

                    $(".drop").focus();
                    alert("You must at least have 1 pdf!");

                    return false;
                }


                //console.log("LICENCE GOOD TO GO ", vm.documents);


                 //clean shizzle before sending
                 //why keep sending back heavy data?

                    // for(var i=0;i<vm.documents.images.length;i++){
                    //     delete vm.documents.images[i].data_uri;
                    // }

                    // // vm.licence.images = vm.licence_images;
                    // vm.documents.images = vm.documents.images.concat(vm.documents);

                    //vm.documents.images = vm.documents.images[0];

                

                if(vm.document.id){
                    //then its an udpate

                    //merge the images left?
                    ClubDocumentService.Update(vm.document)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                //console.log("HUZZAH", vm.document);
                                //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                
                                
                                //move somewhere?
                                $state.go('dashboard.manage_club.documents', {}, { reload: true });





                            } else {

                                alert("Something went terribly wrong... \n\n "+data.message);

                            }

                        });

                } else {


                   


                    //then its a create
                    //console.log("ONE", vm.documents[0]);

                    var the_file = vm.documents[0];
                    //console.log("TWO", the_file);

                    var to_send = {
                        my_file: the_file,
                        title: vm.document.title,
                        description: vm.document.description,
                        club_id: vm.club_id
                    };

                    //console.log("tosend", to_send);

                    ClubDocumentService.Create(to_send)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){

                                //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                
                                
                                //move somewhere?
                                $state.reload();
                                $state.go('dashboard.manage_club.documents', {}, { reload: true });


                            } else {

                                alert("Something went terribly wrong... \n\n "+data.message);

                            }

                        });


                }



            };



   var warning_msg = "By deleting this document no other member will be able to see it."

          $scope.open = function (doc_id) {
            var modalInstance = $uibModal.open({
              animation: true,
              templateUrl: 'views/modals/deleteModal.html',
              controller: 'ModalInstanceCtrl',
              size: "lg",
              resolve: {
                id: function () {
                  return doc_id;
                },
                params: function() {
                  return {id: doc_id};
                },
                warning: function(){
                    return warning_msg;
                }
              }
            });
            modalInstance.result.then(function (doc) {
                var id = doc.id;
              $log.info('PRESSED GO: ', id);
              ClubDocumentService.Delete(vm.user_id, id)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                vm.club_documents = $.grep(vm.club_documents, function(e){ 
                                    return e.id != id; 
                                });

                                
                                //refresh?
                                $state.reload();
                                $state.go('dashboard.manage_club.documents');

                            } else {

                                alert("Something went terribly wrong... \n\n "+data.message);

                            }

                        });
              // ItemService.Delete(vm.user_id, plane_id.id)
              // .then(function(){
              //   //console.log("HELLO DELETE");
              //   //update view?
              //    vm.club.items = $.grep(vm.club.items, function(e){ 
              //       return e.id != plane_id.id; 
              //   });
              // })
            }, function () {
              $log.info('Modal dismissed at: ' + new Date());
            });
          };

            $scope.get_icon = function(file){

                var ft = file.name;
                ft = ft.split('.').pop();
                var icon_name = "";

                // //console.log("FILE:", ft);
                // //console.log("index : ", ft.indexOf("pdf"));
                switch(true){
                    case (ft.indexOf("pdf") > -1):
                        icon_name = "pdf.png";
                    break;
                    case (ft.indexOf("doc") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("docx") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("xls") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("xlsx") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("ppt") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("pptx") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("jpg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("jpeg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("png") > -1):
                        icon_name = "png.png";
                    break;
                    case (ft.indexOf("gif") > -1):
                        icon_name = "gif.png";
                    break;
                    case (ft.indexOf("zip") > -1):
                        icon_name = "zip.png";
                    break;
                    case (ft.indexOf("avi") > -1):
                        icon_name = "avi.png";
                    break;
                    case (ft.indexOf("mp4") > -1):
                        icon_name = "mp4.png";
                    break;
                    default:
                        icon_name = "file.png";
                    break;
                }

                // //console.log("FILE:", icon_name);

                return "images/file_icons/"+icon_name;
            }


            $scope.get_icon2 = function(file){

                var ft = file.split('.').pop();
                // //console.log("ICON 2 : ", ft);
                var icon_name = "";

                // //console.log("FILE:", ft);
                // //console.log("index : ", ft.indexOf("pdf"));
                switch(true){
                    case (ft.indexOf("pdf") > -1):
                        icon_name = "pdf.png";
                    break;
                    case (ft.indexOf("doc") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("docx") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("xls") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("xlsx") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("ppt") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("pptx") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("jpg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("jpeg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("png") > -1):
                        icon_name = "png.png";
                    break;
                    case (ft.indexOf("gif") > -1):
                        icon_name = "gif.png";
                    break;
                    case (ft.indexOf("zip") > -1):
                        icon_name = "zip.png";
                    break;
                    case (ft.indexOf("avi") > -1):
                        icon_name = "avi.png";
                    break;
                    case (ft.indexOf("mp4") > -1):
                        icon_name = "mp4.png";
                    break;
                    default:
                        icon_name = "file.png";
                    break;
                }

                // //console.log("FILE:", icon_name);

                return "images/file_icons/"+icon_name;
            }



            $scope.downloadDocument = function(doc) {
            var data = $.param({
                id: doc
            });

            var ddd = doc.replace(/^.*[\\\/]/, '');

            $http.get('api/v1/plane_documents/show_file/'+ddd, {
                    responseType: 'arraybuffer'
                })
                .success(function(data, status, headers) {
                    var zipName = processArrayBufferToBlob(data, headers);

                    //Delete file from temp folder in server - file needs to remain open until blob is created
                    //deleteFileFromServerTemp(zipName);
                }).error(function(data, status) {
                    alert("There was an error downloading the selected document(s).");
                })
        };



        $scope.downloadClubDocument = function(doc) {
            var data = $.param({
                id: doc
            });

            var ddd = doc.replace(/^.*[\\\/]/, '');

            $http.get('api/v1/club_documents/show_file/'+ddd, {
                    responseType: 'arraybuffer'
                })
                .success(function(data, status, headers) {
                    var zipName = processArrayBufferToBlob(data, headers);

                    //Delete file from temp folder in server - file needs to remain open until blob is created
                    //deleteFileFromServerTemp(zipName);
                }).error(function(data, status) {
                    alert("There was an error downloading the selected document(s).");
                })
        };



        function processArrayBufferToBlob(data, headers) {
            var octetStreamMime = 'application/octet-stream';
            var success = false;

            // Get the headers
            headers = headers();
            //var ttt = title.toLowerCase().replace(/\W/g, '_');
            // Get the filename from the x-filename header or default to "download.bin"
            var filename = headers['x-filename'] || 'download.zip';

            // Determine the content type from the header or default to "application/octet-stream"
            var contentType = headers['content-type'] || octetStreamMime;

            try {
                // Try using msSaveBlob if supported
                var blob = new Blob([data], {
                    type: contentType
                });
                if (navigator.msSaveBlob)
                    navigator.msSaveBlob(blob, filename);
                else {
                    // Try using other saveBlob implementations, if available
                    var saveBlob = navigator.webkitSaveBlob || navigator.mozSaveBlob || navigator.saveBlob;
                    if (saveBlob === undefined) throw "Not supported";
                    saveBlob(blob, filename);
                }
                success = true;
            } catch (ex) {
                $log.info("saveBlob method failed with the following exception:");
                $log.info(ex);
            }

            if (!success) {
                // Get the blob url creator
                var urlCreator = window.URL || window.webkitURL || window.mozURL || window.msURL;
                if (urlCreator) {
                    // Try to use a download link
                    var link = document.createElement('a');
                    if ('download' in link) {
                        // Try to simulate a click
                        try {
                            // Prepare a blob URL
                            var blob = new Blob([data], {
                                type: contentType
                            });
                            var url = urlCreator.createObjectURL(blob);
                            link.setAttribute('href', url);

                            // Set the download attribute (Supported in Chrome 14+ / Firefox 20+)
                            link.setAttribute("download", filename);

                            // Simulate clicking the download link
                            var event = document.createEvent('MouseEvents');
                            event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
                            link.dispatchEvent(event);
                            success = true;

                        } catch (ex) {
                            $log.info("Download link method with simulated click failed with the following exception:");
                            $log.info(ex);
                        }
                    }

                    if (!success) {
                        // Fallback to window.location method
                        try {
                            // Prepare a blob URL
                            // Use application/octet-stream when using window.location to force download
                            var blob = new Blob([data], {
                                type: octetStreamMime
                            });
                            var url = urlCreator.createObjectURL(blob);
                            window.location = url;
                            success = true;
                        } catch (ex) {
                            $log.info("Download link method with window.location failed with the following exception:");
                            $log.info(ex);
                        }
                    }
                }
            }

            if (!success) {
                // Fallback to window.open method
                $log.info("No methods worked for saving the arraybuffer, using last resort window.open");
                window.open(httpPath, '_blank', '');
            }
            return filename;
        };

        
        


    }