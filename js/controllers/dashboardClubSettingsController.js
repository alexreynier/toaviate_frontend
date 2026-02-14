 app.controller('DashboardClubSettingsController', DashboardClubSettingsController);

    DashboardClubSettingsController.$inject = ['UserService', 'ClubService', 'PaymentService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$window', '$http', '$log', 'ToastService', 'AircraftChecksService'];
    function DashboardClubSettingsController(UserService, ClubService, PaymentService, $rootScope, $location, $scope, $state, $stateParams, $window, $http, $log, ToastService, AircraftChecksService) {
        var vm = this;

        vm.user = null;
        vm.allUsers = [];
        vm.club = {};

        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        // ── Aircraft Check Types ──
        vm.check_types = [];
        vm.check_types_loading = false;
        vm.editing_check_type = false;
        vm.check_type_form = { is_active: true, display_order: 1 };

        vm.system_codes = ['check_a', 'transit_check'];

        vm.check_type_codes = [
            { value: 'check_a',       label: 'Check A (first flight of the day)' },
            { value: 'transit_check', label: 'Transit Check (subsequent flights)' },
            { value: 'check_b',       label: 'Check B' },
            { value: 'daily_check',   label: 'Daily Check' },
            { value: 'weekly_check',  label: 'Weekly Check' },
            { value: 'preflight',     label: 'Pre-Flight Inspection' },
            { value: 'annual_check',  label: 'Annual Check' },
            { value: 'custom',        label: 'Custom' }
        ];

        vm.isSystemCode = function(code) {
            return vm.system_codes.indexOf(code) !== -1;
        };

        vm.availableCodeOptions = function() {
            // When editing, show all codes; when adding, hide system codes (they are auto-seeded)
            if (vm.editing_check_type) {
                return vm.check_type_codes;
            }
            return vm.check_type_codes.filter(function(c) {
                return !vm.isSystemCode(c.value);
            });
        };

        vm.loadCheckTypes = function() {
            vm.check_types_loading = true;
            AircraftChecksService.GetCheckTypes(vm.club_id)
                .then(function(data) {
                    vm.check_types_loading = false;
                    if (data.success) {
                        vm.check_types = data.check_types;
                    }
                });
        };

        vm.saveCheckType = function() {
            if (!vm.check_type_form.name || !vm.check_type_form.code) {
                ToastService.warning('Missing Fields', 'Please provide both a Name and Code for the check type.');
                return;
            }

            var payload = {
                club_id: vm.club_id,
                name: vm.check_type_form.name,
                code: vm.check_type_form.code,
                description: vm.check_type_form.description || '',
                is_active: vm.check_type_form.is_active ? 1 : 0,
                display_order: vm.check_type_form.display_order || 1
            };

            if (vm.editing_check_type && vm.check_type_form.id) {
                AircraftChecksService.UpdateCheckType(vm.check_type_form.id, payload)
                    .then(function(data) {
                        if (data.success) {
                            ToastService.success('Updated', 'Check type updated successfully.');
                            vm.closeCheckTypeModal();
                            vm.loadCheckTypes();
                        } else {
                            ToastService.error('Error', data.message || 'Failed to update check type.');
                        }
                    });
            } else {
                AircraftChecksService.CreateCheckType(payload)
                    .then(function(data) {
                        if (data.success) {
                            ToastService.success('Created', 'Check type created successfully.');
                            vm.closeCheckTypeModal();
                            vm.loadCheckTypes();
                        } else {
                            ToastService.error('Error', data.message || 'Failed to create check type.');
                        }
                    });
            }
        };

        vm.show_check_type_modal = false;

        vm.openCheckTypeModal = function() {
            vm.editing_check_type = false;
            vm.check_type_form = { is_active: true, display_order: 1 };
            vm.show_check_type_modal = true;
        };

        vm.closeCheckTypeModal = function() {
            vm.show_check_type_modal = false;
            vm.editing_check_type = false;
            vm.check_type_form = { is_active: true, display_order: 1 };
        };

        vm.editCheckType = function(ct) {
            vm.editing_check_type = true;
            vm.check_type_form = {
                id: ct.id,
                name: ct.name,
                code: ct.code,
                description: ct.description,
                is_active: ct.is_active == 1,
                display_order: ct.display_order
            };
            vm.show_check_type_modal = true;
        };

        vm.cancelEditCheckType = function() {
            vm.closeCheckTypeModal();
        };

        vm.deleteCheckType = function(ct) {
            if (!confirm('Are you sure you want to delete the check type "' + ct.name + '"?')) return;
            AircraftChecksService.DeleteCheckType(ct.id)
                .then(function(data) {
                    if (data.success) {
                        ToastService.success('Deleted', 'Check type deleted successfully.');
                        vm.loadCheckTypes();
                    } else {
                        ToastService.warning('Cannot Delete', data.message || 'Failed to delete check type.');
                    }
                });
        };

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

                // Load aircraft check types
                vm.loadCheckTypes();

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

        vm.clearFieldError = function(event) { ToastService.clearFieldError(event); };

        $scope.save = function(){
            var checks = [
                { ok: vm.club.settings.title,   field: 'title',   label: 'Trading As' },
                { ok: vm.club.settings.email,   field: 'email',   label: 'Email' },
                { ok: vm.club.settings.address, field: 'address', label: 'Registered Address' }
            ];
            if (vm.club.settings.vat_registered) {
                checks.push({ ok: vm.club.settings.vat_number, field: 'vat_number', label: 'VAT Number' });
                checks.push({ ok: vm.club.settings.vat_rate != null && vm.club.settings.vat_rate !== '', field: 'vat_rate', label: 'VAT Rate' });
            }
            if (!ToastService.validateForm(checks)) return;

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
                        ToastService.success('Stripe Redirect', 'You will be redirected to Stripe - please complete the setup and you will be returned to ToAviate');
                        window.location = data.onboarding_link;
                    } else {
                        ToastService.error('Stripe Error', "Please try the link again! Stripe didn't seem to want to connect to ToAviate");
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
                    ToastService.error('Download Error', 'There was an error downloading the selected document(s)');
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