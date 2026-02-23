 app.controller('DashboardClubExperiencesController', DashboardClubExperiencesController);

    DashboardClubExperiencesController.$inject = ['UserService', 'PlaneService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'LicenceService', 'MedicalService', 'DifferencesService', 'ExperiencesService', 'ToastService', 'VoucherWidgetService', '$sce', 'EnvConfig', '$timeout'];
    function DashboardClubExperiencesController(UserService, PlaneService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, LicenceService, MedicalService, DifferencesService, ExperiencesService, ToastService, VoucherWidgetService, $sce, EnvConfig, $timeout) {
        var vm = this;

        vm.user = null;
        vm.allUsers = [];
        vm.club = {
            item: {
                planes: []
            }
        };
        vm.page_title = "";
        
        vm.plane_document = {};
        vm.plane_documents = [];

        // ── Experience Images & Blurb ──
        vm.experience_images = [];
        vm.images_loading = false;
        vm.image_uploading = false;
        vm.image_upload_progress = '';
        vm.widget_token = null;
        vm.blurb_saving = false;
        vm.blurb_dirty = false;
        vm.drag_source_index = null;

        var update_this_file = [];
        

        vm.action = $state.current.data.action;
        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        vm.charge_type = ["brakes", "session", "plane"];


        vm.planes = [];
        vm.club.item.planes = [];
        vm.temporary = {};
        vm.temporary.plane = {};

        PlaneService.GetAllByClub(vm.club_id)
                    .then(function(data){
                        //console.log("planes", data);
                        vm.planes = data;
                    });

        ////console.log("club_id : "+vm.club_id);

        // //console.log(vm.action);
         //console.log($stateParams);
        // //console.log($stateParams.id);
        switch(vm.action){
            case "add":
                //console.log("adding a new plane please");
                vm.page_title = "Add an Experience";
            break;
            case "edit":
                //console.log("edit an existing plane");
                 //console.log($stateParams);
                ExperiencesService.GetById($stateParams.id)
                    .then(function(data){
                        vm.club.item = data.item; 
                        // Load images for this experience
                        vm.loadImages();
                    });

                // Load widget token for image serving URLs
                VoucherWidgetService.GetToken(vm.club_id)
                    .then(function(data) {
                        if (data.success && data.token) {
                            vm.widget_token = data.token.token || data.token;
                        }
                    });

            break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                ExperiencesService.GetByClubId(vm.club_id)
                    .then(function(data){
                        vm.club.items = data.items;   
                        //console.log(vm.club.items);
                    });
            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  

        //'9' needs to refer the the user's account set to manage
       
        $scope.back = function(){
            $rootScope.safeBack();
        }

        // ═══════════════════════════════════════════════
        // EXPERIENCE IMAGES
        // ═══════════════════════════════════════════════

        vm.loadImages = function() {
            if (!$stateParams.id) return;
            vm.images_loading = true;
            ExperiencesService.GetImages(vm.club_id, $stateParams.id)
                .then(function(data) {
                    vm.images_loading = false;
                    if (data.success && data.images) {
                        vm.experience_images = data.images;
                    } else {
                        vm.experience_images = [];
                    }
                }, function() {
                    vm.images_loading = false;
                    vm.experience_images = [];
                });
        };

        vm.getImageUrl = function(image) {
            if (!image || !image.file_name) return '';
            var token = (vm.widget_token && vm.widget_token.token) ? vm.widget_token.token : vm.widget_token;
            if (!token) {
                // Fallback: use authenticated endpoint
                return EnvConfig.getApiBaseUrl() + '/api/v1/voucher_widget_tokens/experience_images/' + vm.club_id + '/' + image.id + '/file';
            }
            return EnvConfig.getApiBaseUrl() + '/api/v1/voucher_widget/' + token + '/image/' + image.file_name;
        };

        vm.onImageFileSelected = function(files) {
            if (!files || files.length === 0) return;
            if (!$stateParams.id) {
                ToastService.warning('Save First', 'Please save the experience before uploading images.');
                return;
            }
            if (vm.experience_images.length >= 10) {
                ToastService.warning('Limit Reached', 'Maximum 10 images per experience.');
                return;
            }

            var file = files[0];
            var allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];
            if (allowed.indexOf(file.type) === -1) {
                ToastService.error('Invalid File', 'Only JPG, PNG, and GIF images are allowed.');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                ToastService.error('File Too Large', 'Maximum file size is 10 MB.');
                return;
            }

            vm.image_uploading = true;
            vm.image_upload_progress = 'Uploading ' + file.name + '…';

            ExperiencesService.UploadImage(file, vm.club_id, $stateParams.id)
                .then(function(data) {
                    vm.image_uploading = false;
                    vm.image_upload_progress = '';
                    if (data.success) {
                        ToastService.success('Uploaded', 'Image uploaded successfully.');
                        vm.loadImages();
                    } else {
                        ToastService.error('Upload Failed', data.message || 'Could not upload image.');
                    }
                }, function() {
                    vm.image_uploading = false;
                    vm.image_upload_progress = '';
                    ToastService.error('Upload Failed', 'Could not connect to the server.');
                });
        };

        vm.deleteImage = function(image, $event) {
            if ($event) $event.stopPropagation();
            if (!confirm('Delete this image?')) return;

            ExperiencesService.DeleteImage(vm.club_id, image.id)
                .then(function(data) {
                    if (data.success) {
                        ToastService.success('Deleted', 'Image removed.');
                        vm.loadImages();
                    } else {
                        ToastService.error('Error', data.message || 'Could not delete image.');
                    }
                }, function() {
                    ToastService.error('Error', 'Could not connect to the server.');
                });
        };

        // Drag-and-drop reorder
        vm.onDragStart = function(index) {
            vm.drag_source_index = index;
        };

        vm.onDrop = function(targetIndex) {
            if (vm.drag_source_index === null || vm.drag_source_index === targetIndex) return;
            var moved = vm.experience_images.splice(vm.drag_source_index, 1)[0];
            vm.experience_images.splice(targetIndex, 0, moved);
            vm.drag_source_index = null;
            vm.saveImageOrder();
        };

        vm.onDragEnd = function() {
            vm.drag_source_index = null;
        };

        vm.moveImage = function(index, direction) {
            var newIndex = index + direction;
            if (newIndex < 0 || newIndex >= vm.experience_images.length) return;
            var temp = vm.experience_images[index];
            vm.experience_images[index] = vm.experience_images[newIndex];
            vm.experience_images[newIndex] = temp;
            vm.saveImageOrder();
        };

        vm.saveImageOrder = function() {
            var ids = vm.experience_images.map(function(img) { return img.id; });
            ExperiencesService.ReorderImages(vm.club_id, $stateParams.id, ids)
                .then(function(data) {
                    if (!data.success) {
                        ToastService.error('Error', 'Could not save image order.');
                    }
                });
        };

        // ═══════════════════════════════════════════════
        // EXPERIENCE BLURB (long_description)
        // ═══════════════════════════════════════════════

        vm.blurbChanged = function() {
            vm.blurb_dirty = true;
        };

        vm.saveBlurb = function() {
            if (!$stateParams.id) {
                ToastService.warning('Save First', 'Please save the experience before editing the blurb.');
                return;
            }
            vm.blurb_saving = true;
            var html = vm.club.item.long_description || '';

            ExperiencesService.UpdateBlurb(vm.club_id, $stateParams.id, html)
                .then(function(data) {
                    vm.blurb_saving = false;
                    if (data.success) {
                        vm.blurb_dirty = false;
                        ToastService.success('Saved', 'Experience blurb updated.');
                    } else {
                        ToastService.error('Error', data.message || 'Could not save blurb.');
                    }
                }, function() {
                    vm.blurb_saving = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
        };

        // ── Blurb formatting commands ──
        // Toolbar uses <span> elements (not <button>) so they never steal
        // focus from the contenteditable editor. This means the selection
        // is always preserved and document.execCommand works directly.

        vm.execCommand = function(command, value) {
            document.execCommand(command, false, value || null);
            vm.blurb_dirty = true;
        };

        vm.insertLink = function() {
            var url = prompt('Enter URL:');
            if (url) {
                document.execCommand('createLink', false, url);
                vm.blurb_dirty = true;
            }
        };

        vm.trustHtml = function(html) {
            return $sce.trustAsHtml(html || '');
        };

        vm.clearFieldError = function(event) { ToastService.clearFieldError(event); };

        $scope.save = function(){
            var item = vm.club.item || {};
            var checks = [
                { ok: item.title,                                                              field: 'title',            label: 'Title' },
                { ok: item.price != null && item.price !== '',                                  field: 'price',            label: 'Price' },
                { ok: item.valid_for != null && item.valid_for !== '',                          field: 'valid_for',        label: 'Validity (days)' },
                { ok: item.booking_duration != null && item.booking_duration !== '',             field: 'booking_duration', label: 'Slot Required (hours)' }
            ];
            if (!ToastService.validateForm(checks)) return;

            if (!item.planes || item.planes.length < 1) {
                ToastService.highlightField('.card');
                ToastService.warning('Aircraft Required', 'You must add at least 1 aircraft to this experience.');
                return;
            }

            if(vm.action == "add"){
                $scope.create();
            } else {
                $scope.update();
            }
        }


        $scope.create = function(){
            //console.log("CREATE ME NOW");
            vm.club.item.club_id = vm.club_id;
            ExperiencesService.Create(vm.club.item)
                .then(function(data){
                    //console.log(data);
                    //$state.reload();
                    $state.go('dashboard.manage_club.experiences', {}, {reload: true});

                });
        }

        $scope.delete = function(){
            //console.log("CLICK");
            ToastService.warning('Confirm Delete', 'Are you sure you would like to delete this plane?');
            ExperiencesService.Delete(vm.user.id, vm.club.item)
                .then(function(data){
                    //console.log(data);
                });
        }

        function get_update_docs(){
            var documents = [];

            for(var i=0;i<update_this_file.length;i++){
                var id = update_this_file[i];
                //console.log("looking for : ", id);
                //console.log("in: ", vm.plane_documents);

                for(var k=0;k<vm.club.plane.plane_documents.length;k++){
                    //console.log("comparing to : ", vm.club.plane.plane_documents[k].id);
                    if(vm.club.plane.plane_documents[k].id == id){
                        documents.push(vm.club.plane.plane_documents[k]);
                    }
                }

            }

            // //console.log("DOCS TO UPDATE : ", documents);

            return documents;
        }

        $scope.update = function(){
            //console.log("CLICK");
            vm.club.item.club_id = vm.club_id;
            ExperiencesService.Update(vm.club.item, vm.user.id)
                .then(function(data){
                    //console.log(data);
                    //console.log("saved");
                    //$state.reload();
                    $state.go('dashboard.manage_club.experiences', {}, {reload: true});
                });
        }


        function containsObject(obj, list, params) {

            // //console.log("obj", obj);
            // //console.log("list", list);
            // //console.log("params", params);

            for(var i=0; i<list.length; i++) {
                // //console.log("list i : ", list[i]);
                // //console.log("obj is: ", obj);

                var count_success = 0;
                for(var j=0;j<params.length;j++){
                    if(list[i][params[j]] && obj[params[j]] && list[i][params[j]] == obj[params[j]]){
                        count_success++;
                    }
                }

                if(count_success === params.length) {                    
                    return true;
                }
            }

            return false;
        }




        function check_all(){

            //maybe a nice to have one day... not yet though.


            //licences
            vm.club.plane.requirements.licence.forEach(function(obj){

            });

        }

      



        $scope.add_item = function(type){
            //console.log("ADD");
            switch(type){
                case "plane":
                    //console.log("plane");
                    if(vm.temporary.plane && vm.temporary.plane.id){
                        //then we can add it
                        //console.log("here we go");
                        // var add_plane = {
                        //     id: vm.temporary.plane.id
                        // };

                        //check if it doesnt exist first...
                        //if(vm.club.item.planes && vm.club.item.planes.indexOf(vm.temporary.plane.plane_id) == -1){


                        if(!vm.club.item.planes){
                            vm.club.item.planes = [];
                        }

                        if(containsObject(vm.temporary.plane, vm.club.item.planes, new Array("plane_id") ) == false){
                            vm.club.item.planes.push(vm.temporary.plane);

                            // vm.club.item.planes.indexOf(vm.temporary.plane)
                            // vm.planes.filter(function(el) { return el.plane_id !== vm.temporary.plane.plane_id; });
                        } 

                        delete vm.temporary.plane;

                    } else {
                        ToastService.highlightField('add_aircraft_select');
                        ToastService.warning('Missing Plane', 'Please select a plane that this activity be done on!');
                    }

                break;

            }



        }


        $scope.remove_item = function(type, index){
            //console.log("REMOVE");

            vm.club.item.planes.splice(index, 1);


            // switch(type){
            //     case "plane":
            //             //console.log("plane");
                   
            //             //check if it doesnt exist first...
            //             // if(containsObject(add_licence, vm.club.plane.requirements.licence, new Array("licence_id", "rating_id")) == false){
            //             //     vm.club.plane.requirements.licence.push(add_licence);
            //             // }

            //             vm.club.item.planes.splice(index, 1);
                      
            //     break;
            // }


            //     case "medical":
            //         //console.log("medical");
            //         if(vm.temporary.medical_authority && vm.temporary.medical_authority !== "" && vm.temporary.medical_component && vm.temporary.medical_component !== ""){
            //             //then we can add it
            //             //console.log("here we go");
            //             var add_medical = {
            //                 authority_id: vm.temporary.medical_authority.id,
            //                 authority_title: vm.temporary.medical_authority.abbreviation,
            //                 medical_component_id: vm.temporary.medical_component.id,
            //                 medical_component_title: vm.temporary.medical_component.title
            //             };

            //             //check if it doesnt exist first...
            //             if(containsObject(add_medical, vm.club.plane.requirements.medical, new Array("authority_id", "medical_component_id")) == false){
            //                 vm.club.plane.requirements.medical.push(add_medical);
            //             }

            //             delete vm.temporary.medical_authority;
            //             delete vm.temporary.medical_component;

            //         } else {
            //             alert("Please select a medical that is required to book the plane solo!");
            //         }

            //     break;


            //     case "differences":
            //         //console.log("difference");
            //         if(vm.temporary.difference && vm.temporary.difference !== ""){
            //             //then we can add it
            //             //console.log("here we go");
            //             var add_difference = {
            //                 difference_id: vm.temporary.difference.id,
            //                 difference_title: vm.temporary.difference.title
            //             };

            //             //check if it doesnt exist first...
            //             if(containsObject(add_difference, vm.club.plane.requirements.differences, new Array("difference_id", "difference_title")) == false){
            //                 vm.club.plane.requirements.differences.push(add_difference);
            //             }

            //             delete vm.temporary.difference;

            //         } else {
            //             alert("Please select a difference that is required to book the plane solo!");
            //         }

            //     break;


            // }



        }
















        $scope.update_this_file = function(file){
            //console.log("==== update is : ", file.id);
            if(update_this_file.indexOf(file.id) === -1){
                update_this_file.push(file.id)
            } else {
               ////console.log("This item already exists"); 
            } 
        }


         $scope.remove_real_file = function(file){

                //remove_file

                vm.club.plane.plane_documents = $.grep(vm.club.plane.plane_documents, function(e){ 
                        return e.id != file.id; 
                    });

                //no need to actually remove the file as it will be archived accordingly on the backend whilst it is missing! :)
                PlaneDocumentService.Delete(vm.user.id, file.id)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.plane_documents = [];
                        //and re-process available files
                        $scope.processFiles(current_files);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

          }


          
          $scope.remove_file = function(file, current_files){

            //remove_file
            var j = JSON.parse(file.file_return);
            //console.log("REMOVE: ", j);
            //console.log("REMOVE: ", j.saved_url);

            //to delete the temp file created: j.saved_url
            //tmp_rm.php POST tmp = filename
            
            PoidService.DeleteTmp(j.saved_url)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.plane_documents = [];
                        //and re-process available files
                        $scope.processFiles(current_files);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

          }
          

          // $scope.$on('flow::fileAdded', function (event, $flow, flowFile) {
          //     event.preventDefault();//prevent file from uploading
          //     //console.log("FILE ADDED");
          //     //console.log($flow);
          //   });

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
                    vm.plane_documents.push(files[i].file);
                }


            }

            $scope.set_title = function(file){
                //console.log("return", file);
                return file.save_name;
            }

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



            $scope.delete_poid = function(id){

              
                var a = prompt("Are you sure you wish to delete this poid? \n\n This change is irreversible! To confirm please type YES in the box below.");
                if(a == "YES"){


                    //console.log("WE DELETE IT");


                    // PoidService.Delete(vm.user_id, id)
                    //     .then(function (data) {
                    //         //console.log(data);
                    //         if(data.success){
                    //             //console.log("HUZZAH", data);
                    //             //then we need to remove this from the list of files...
                    //             vm.user_poids = $.grep(vm.user_poids, function(e){ 
                    //                 return e.id != id; 
                    //             });
                                
                    //             //refresh?
                    //             $state.reload();
                    //             $state.go('dashboard.my_account.poid');

                    //         } else {

                    //             alert("Something went terribly wrong... \n\n "+data.message);

                    //         }

                    //     });



                } else {
                    //console.log("ignore123");
                }


            }




            $scope.save_plane_documents = function(){

               
              

                //console.log("plane_documents: ", vm.plane_documents);


                //compile the required elements YAY

                //console.log("plane_document ", vm.plane_document);


                 //clean shizzle before sending
                 //why keep sending back heavy data?

                    // for(var i=0;i<vm.plane_document.images.length;i++){
                    //     delete vm.plane_document.images[i].data_uri;
                    // }

                    // // vm.plane_document.images = vm.plane_documents;
                    // vm.plane_document.images = vm.plane_document.images.concat(vm.plane_documents);
                    // vm.plane_document.user_id = vm.user_id;




            //     if(vm.plane_document.id){
            //         //then its an udpate

            //         //merge the images left?
            //         PoidService.Update(vm.plane_document)
            //             .then(function (data) {
            //                 //console.log(data);
            //                 if(data.success){
            //                     //console.log("HUZZAH", vm.plane_document);
            //                     //console.log("HUZZAH", data);
            //                     //then we need to remove this from the list of files...
                                
                                
            //                     //move somewhere?
            //                     $state.go('dashboard.my_account.poid', {}, { reload: true });





            //                 } else {

            //                     alert("Something went terribly wrong... \n\n "+data.message);

            //                 }

            //             });

            //     } else {


                   


            //         //then its a create
            //         //console.log(vm.plane_document);

            //         PoidService.Create(vm.plane_document)
            //             .then(function (data) {
            //                 //console.log(data);
            //                 if(data.success){
            //                     //console.log("HUZZAH", vm.plane_document);
            //                     //console.log("HUZZAH", data);
            //                     //then we need to remove this from the list of files...
                                
                                
            //                     //move somewhere?
            //                    // $state.reload();
            //                    // $state.go('dashboard.my_account.poid', {}, { reload: true });


            //                 } else {

            //                     alert("Something went terribly wrong... \n\n "+data.message);

            //                 }

            //             });


            //     }



             };




             $scope.change_file_name = function(file){
                
                //this is terribly ineficient... unfortunately... can't 
                //work out how else to do it! (lol)

                // //console.log("TO BE CHANGED", file);

                // //console.log("BEFORE BEFORE", vm.plane_documents);

                vm.plane_documents = $.grep(vm.plane_documents, function(e){ 
                    return e.temp_path != file.temp_path; 
                });

                // //console.log("BEFORE", vm.plane_documents);

                vm.plane_documents.push(file);

                // //console.log("AFTER", vm.plane_documents);

             }














        initController();

        function initController() {
           //console.log("check if access is okay");
        }


            var warning_msg = "By deleting this plane, you will also cancel all reservations that this plane currently has."

          $scope.open = function (plane_id) {
            var modalInstance = $uibModal.open({
              animation: true,
              templateUrl: 'views/modals/deleteModal.html',
              controller: 'ModalInstanceCtrl',
              size: "lg",
              resolve: {
                id: function () {
                  return plane_id;
                },
                params: function() {
                  return {id: plane_id};
                },
                warning: function(){
                    return warning_msg;
                }
              }
            });
            modalInstance.result.then(function (plane_id) {
              $log.info('PRESSED GO: '+plane_id.id);
              ExperiencesService.Delete(vm.user.id, plane_id.id)
              .then(function(){
                //console.log("HELLO DELETE");
                //update view?
                 vm.club.items = $.grep(vm.club.items, function(e){ 
                    return e.id != plane_id.id; 
                });
              })
            }, function () {
              $log.info('Modal dismissed at: ' + new Date());
            });
          };

         


    }