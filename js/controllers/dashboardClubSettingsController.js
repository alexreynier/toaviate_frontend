 app.controller('DashboardClubSettingsController', DashboardClubSettingsController);

    DashboardClubSettingsController.$inject = ['UserService', 'ClubService', 'PaymentService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$window', '$http', '$log'];
    function DashboardClubSettingsController(UserService, ClubService, PaymentService, $rootScope, $location, $scope, $state, $stateParams, $window, $http, $log) {
        var vm = this;

        vm.user = null;
        vm.allUsers = [];
        vm.club = {};

        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;
        
        vm.action = $state.current.data.action;


        switch(vm.action){
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                //'9' needs to refer the the user's account set to manage
                ClubService.GetById(vm.club_id)
                    .then(function(data){
                        vm.club.settings = data;
                        vm.club.settings.vat_registered = (vm.club.settings.vat_registered == 1)? true : false;
                        vm.club.settings.tpc_aircraft_surchages = (vm.club.settings.tpc_aircraft_surchages == 1)? true : false;
                        vm.club.settings.vat_rate = parseFloat(vm.club.settings.vat_rate);
                        //console.log(vm.club);
                    });


            break;
            case "stripe_return":
                //need to update this to be part of the authentication
                //to find out club id
                vm.stripe_id = $stateParams.stripe_id;
                //generate a link here and do something cool with it!!
                PaymentService.SaveStripeLink(vm.club_id, vm.stripe_id)
                .then(function(data){
                    console.log(data);

                    //$state.go('dashboard.manage_club');
                });

            break;
            case "stripe_refresh":
                //need to update this to be part of the authentication
                vm.stripe_id = $stateParams.stripe_id;
                //to find out club id
                PaymentService.RefreshStripeLink(vm.club_id, vm.stripe_id)
                    .then(function(data){
                        //vm.club.courses = data.items;   
                        console.log(data);
                    });
            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  


       


        $scope.processFiles = function(files, image){

            for(var i=0; i<files.length; i++){
                // //console.log("JSON", files[i].file_return);
                var j = JSON.parse(files[i].file_return);
                // //console.log("PARSED", j);
                files[i].file.temp_path = j.saved_url;

                var update_text = "update_"+image;
                // //console.log("file", files[i].file);
                vm.club.settings[image] = files[i].file;
                vm.club.settings[image] = files[i].file.temp_path;
                vm.club.settings[update_text] = true;
                // //console.log(vm.club.settings[image]);
            }
           
        }

        $scope.save = function(){
            // //console.log("CLICKED", vm.club.settings);
            //return false;


            if(!vm.club.settings.update_logo){
                    delete vm.club.settings.logo;
            }
            if(!vm.club.settings.update_invoice_logo){
                    delete vm.club.settings.invoice_logo;
            }

            if(vm.privacy_file){
                vm.club.settings.privacy_terms = vm.privacy_file;
            } else {
                delete(vm.club.settings.privacy_terms);
            }

            if(vm.membership_file){
                vm.club.settings.membership_terms = vm.membership_file;
            }else {
                delete(vm.club.settings.membership_terms);
            }

            if(vm.passenger_file){
                vm.club.settings.passenger_terms = vm.passenger_file;
            }else {
                delete(vm.club.settings.passenger_terms);
            }

            delete(vm.club.settings.membership_updated);
            delete(vm.club.settings.passenger_updated);
            delete(vm.club.settings.privacy_updated);

            delete(vm.club.settings.updated_at);
            delete(vm.club.settings.created_at);
            delete(vm.club.settings.gcl);
            delete(vm.club.settings.salt);
            delete(vm.club.settings.pepper);

            vm.club.settings.vat_registered = (vm.club.settings.vat_registered)? 1 : 0;
            vm.club.settings.tpc_aircraft_surchages = (vm.club.settings.tpc_aircraft_surchages)? 1 : 0;
            

            ClubService.Update(vm.club.settings)
                .then(function(data){
                    //console.log(data);
                    $state.go('dashboard.manage_club');
                });
        }

        initController();

        function initController() {
           //console.log("check if access is okay");
        }

        vm.called_stripe_setup = false;
        vm.generate_stripe_link = function(){

            vm.called_stripe_setup = true;

            //generate a link here and do something cool with it!!
            PaymentService.GenerateStripeLink(vm.club.settings)
                .then(function(data){
                    console.log(data);

                    if(data.success && data.onboarding_link !== ''){
                        alert("You will be redirected to Stripe - please complete the setup and you will be returned to ToAviate");
                        window.location = data.onboarding_link;
                    } else {
                        alert("Please try the link again! Stripe didn't seem to want to connect to ToAviate");
                        vm.called_stripe_setup = false;
                    }


                    //$state.go('dashboard.manage_club');
                });


        }

        vm.term_documents = [];

         $scope.processFiles2 = function(files, current_files){
                // //console.log("files", files);

                for(var i=0; i<files.length; i++){
                    // //console.log("JSON", files[i].file_return);
                    var j = JSON.parse(files[i].file_return);
                    // //console.log("PARSED", j);
                    // //console.log("J is : ",j);
                    // //console.log("name is : ", j.files.file.name);

                    files[i].file.temp_path = j.saved_url;
                    files[i].file.save_name = j.files.file.name;
                    var ft = j.files.file.name;
                    ft = ft.split('.').pop();
                    files[i].file.extension = ft;

                    // //console.log("file", files[i].file);
                    switch(current_files){
                        case 'privacy':
                        vm.privacy_file = files[i].file;
                        break;
                        case 'membership':
                        vm.membership_file = files[i].file;
                        break;
                        case 'passenger':
                        vm.passenger_file = files[i].file;
                        break;
                    }
                    //vm.term_documents[current_files] = files[i].file;
                }


            }

            $scope.delete_file = function(filetype){
                var to_delete;
                    switch(filetype){
                        case 'privacy':
                        to_delete = vm.club.settings.privacy_terms;
                        vm.club.settings.privacy_terms = "";
                        break;
                        case 'membership':
                        to_delete = vm.club.settings.membership_terms;
                        vm.club.settings.membership_terms = "";
                        break;
                        case 'passenger':
                        to_delete = vm.club.settings.passenger_terms;
                        vm.club.settings.passenger_terms = "";
                        break;
                    }
                    
                    //think about deleting the actual file API call





            }

            $scope.remove_file = function(file, current_files){

                //remove_file
                var j = JSON.parse(file.file_return);
                //console.log("REMOVE: ", j);
                //console.log("REMOVE: ", j.saved_url);


                // PoidService.DeleteTmp(j.saved_url)
                //     .then(function (data) {
                //         //console.log(data);
                //         if(data.success){
                //             //console.log("HUZZAH", current_files);
                //             //then we need to remove this from the list of files...
                //             //clear files
                //             vm.plane_documents = [];
                //             //and re-process available files
                //             $scope.processFiles(current_files);

                //         } else {
                //             //console.log("WOOOPSIES...");
                //             //this should be very very rare...
                //         }

                //     });

              }

            $scope.set_title = function(file){
                //console.log("return", file);
                return file.save_name;
            }

            $scope.back = function(){
                $window.history.back();
            }

            $scope.get_icon = function(file){

                var ft;
                if(file && file.name){
                     ft = file.name;
                } else {
                    ft = file;
                }
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

        function titlepath(path,name){

        //In this path defined as your pdf url and name (your pdf name)
            var prntWin = window.open();
            prntWin.document.write("<html><head><title>"+name+"</title></head><body>"
                + '<embed width="100%" height="100%" name="plugin" src="'+ path+ '" '
                + 'type="application/pdf" internalinstanceid="21"></body></html>');
            prntWin.document.close();
        }

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
                var blob = new Blob([data], 
                    //type: contentType
                    {type: 'application/pdf'}
                //}
                );


                var fileURL = URL.createObjectURL(blob);
                //window.open(fileURL);
                titlepath(fileURL, "Secure Documents");
                
                // if (navigator.msSaveBlob)
                //     navigator.msSaveBlob(blob, filename);
                // else {
                //     // Try using other saveBlob implementations, if available
                //     var saveBlob = navigator.webkitSaveBlob || navigator.mozSaveBlob || navigator.saveBlob;
                //     if (saveBlob === undefined) throw "Not supported";
                //     saveBlob(blob, filename);
                // }
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