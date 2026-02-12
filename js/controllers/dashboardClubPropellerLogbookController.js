 app.controller('DashboardClubPropellerLogbookController', DashboardClubPropellerLogbookController);

    DashboardClubPropellerLogbookController.$inject = ['UserService', 'PlaneService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'LicenceService', 'MedicalService', 'DifferencesService', 'PlaneDocumentService', '$http', 'ToastService', 'LogbookLinkService', 'WorkpackService'];
    function DashboardClubPropellerLogbookController(UserService, PlaneService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, LicenceService, MedicalService, DifferencesService, PlaneDocumentService, $http, ToastService, LogbookLinkService, WorkpackService) {
        var vm = this;

       
        
        switch(vm.action){
            case "add":
                // //console.log("adding a new plane please");
                vm.page_title = "Add a New Plane";
            break;
            case "edit":
                // //console.log("edit an existing plane");
                
                PlaneService.GetByIdMaintenance2($stateParams.plane_id, vm.club_id)
                    .then(function(data){
                        vm.club.plane = data;  
                        vm.this_plane_id = $stateParams.plane_id; 

                        if(vm.club.plane && vm.club.plane.maintenance){
                            //console.log("vm.club.plane == > ", vm.club.plane);
                            vm.obj.hours_remaining = vm.club.plane.maintenance.hours_remaining;
                            vm.obj.next_check = new Date(vm.club.plane.maintenance.next_maintenance);
                            vm.obj.check_date = new Date();
                            vm.obj.extension_granted = new Date();
                        }
                       

                        // vm.club.plane.requirements = {
                        //         licence: [],
                        //         medical: [],
                        //         differences: [],
                        //         hours: []
                        // };
                        // //console.log("BOOOO - get all planes....");
                        vm.page_title = "Edit a Plane Maintenance - "+vm.club.plane.registration;
                    });

                PlaneService.GetOpenIssues($stateParams.plane_id)
                    .then(function (data) {
                            ////console.log("data is : ", data);
                           vm.reported_defects = data;
                        });


               


            break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                // PlaneService.GetAllByClubMaintenance(vm.club_id)
                //     .then(function(data){
                //         vm.club.planes = data;   
                //         // //console.log(vm.club.planes);
                //     });
            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  

       

        $scope.get_hours_from_decimal = function(time){

            if(time){
                 var sign = time < 0 ? "-" : "";
                 var hour = Math.floor(Math.abs(time));
                 var min = Math.round((Math.abs(time) * 60) % 60);
                 if(min == 60){
                     hour++;
                     min = 0;
                 }
                 return sign + (hour < 10 ? "0" : "") + hour + ":" + (min < 10 ? "0" : "") + min;
             } else {
                 return "N/A";
             }
            

        }

        vm.prop_no = "";

        // PlaneService.GetAircraftJourneyLogs($stateParams.plane_id, 0, 25)
        //     .then(function (data) {
        //             // //console.log("ALL is : ", data);
        //            // vm.logs = data.logs;
        //            vm.aircraft = data.aircraft;
        //            if(vm.aircraft.propeller_2_id > 0){

        //                    // console.log(vm.aircraft);

        //                if(vm.aircraft.propeller_2_id == $stateParams.prop_id){
        //                    // console.log("show 2");
        //                    vm.prop_no = "2";
        //                } else {
        //                    // console.log("show 1");
        //                    vm.prop_no = "1";
        //                }
        //            }


        //         });


            PlaneService.GetPropLogs($stateParams.prop_id, $stateParams.plane_id, 0, 25)
            .then(function (data) {
                    // //console.log("ALL is : ", data);
                   vm.logs = data.logs;
                   vm.propeller = data.propeller;


                });

            vm.current_offset = 0;
            vm.loaded_per_batch = 25;
            vm.all_loaded = false;

            vm.load_more = function(){
                vm.current_offset = vm.current_offset + vm.loaded_per_batch;
                PlaneService.GetPropLogs($stateParams.prop_id,$stateParams.plane_id, vm.current_offset, vm.loaded_per_batch)
                .then(function (data) {
                        // //console.log("ALL is : ", data);
                        if(data.logs.length > 0){
                            data.logs.forEach(log => vm.logs.push(log));
                        } else {
                            vm.all_loaded = true;
                        }
                       //vm.logs = data.logs;
                       vm.propeller = data.propeller;


                    });

            }

            vm.get_initial = function(text){
                return text.charAt(0);
            }


            vm.clean_times = function(time){
                if(time == "00:00:00"){
                    return " - ";
                }
                return time.substring(0,5);
            }

            // ── Maintenance entry helpers ──

            vm.maintenanceTypeLabels = {
                '50hour': '50-Hour Check',
                '100hour': '100-Hour Check',
                '150hour': '150-Hour Check',
                '25hours': '25-Hour Check',
                '50hours': '50-Hour Check',
                '100hours': '100-Hour Check',
                'annual': 'Annual Inspection',
                'cofa': 'Certificate of Airworthiness',
                'arc': 'Airworthiness Review Certificate',
                'engine_overhaul': 'Engine Overhaul',
                'propeller_overhaul': 'Propeller Overhaul',
                'interim': 'Interim Inspection',
                '6months': '6-Month Check',
                'extension': 'Extension',
                'workpack': 'Workpack',
                'other': 'Other Maintenance'
            };

            vm.formatMaintenanceType = function(type) {
                return vm.maintenanceTypeLabels[type] || type || 'Maintenance';
            };

            vm.isMaintenanceEntry = function(log) {
                return (log.entry_type === 'maintenance_check');
            };

            vm.getEntryType = function(log) {
                return log.entry_type || 'flight';
            };

            vm.getEntryPosition = function(log) {
                return log.entry_position || 'full_day';
            };

            vm.getHoursRemainingClass = function(hoursRemaining) {
                if (hoursRemaining === null || hoursRemaining === undefined) return '';
                if (hoursRemaining <= 5) return 'hours-critical';
                if (hoursRemaining <= 10) return 'hours-warning';
                return '';
            };

            vm.formatHoursRemaining = function(hoursRemaining) {
                if (hoursRemaining === null || hoursRemaining === undefined) return 'N/A';
                return hoursRemaining.toFixed(2) + ' hrs';
            };

            // ── Maintenance check detail panel ──
            vm.selected_check = null;
            vm.show_check_detail = false;
            vm.check_logbook_links = [];
            vm.check_logbook_loading = false;
            vm.check_logbook_error = false;
            vm.check_workpack = null;
            vm.check_workpack_loading = false;

            vm.viewMaintenanceCheck = function(log) {
                if (!vm.isMaintenanceEntry(log)) return;
                vm.selected_check = log;
                vm.show_check_detail = true;

                // Reset state
                vm.check_logbook_links = [];
                vm.check_logbook_error = false;
                vm.check_workpack = null;

                var checkData = log.maintenance_check || {};
                var checkId = checkData.id || log.maintenance_check_id || null;
                if (checkId) {
                    vm.loadCheckLogbookLinks(checkId);
                    vm.loadCheckWorkpack(log);
                }
            };

            vm.closeMaintenanceCheck = function() {
                vm.selected_check = null;
                vm.show_check_detail = false;
                vm.check_logbook_links = [];
                vm.check_logbook_error = false;
                vm.check_workpack = null;
            };

            // Load logbook associations for a maintenance check.
            vm.loadCheckLogbookLinks = function(maintenance_check_id) {
                if (!maintenance_check_id) return;
                vm.check_logbook_loading = true;
                vm.check_logbook_error = false;
                vm.check_logbook_links = [];

                LogbookLinkService.GetAvailableLogbooks($stateParams.plane_id)
                    .then(function(availData) {
                        var available = (availData && availData.available_logbooks) ? availData.available_logbooks : [];
                        if (available.length === 0) {
                            vm.check_logbook_loading = false;
                            vm.check_logbook_error = true;
                            return;
                        }

                        LogbookLinkService.GetLinks(maintenance_check_id)
                            .then(function(linkData) {
                                vm.check_logbook_loading = false;
                                var links = [];
                                if (linkData && linkData.maintenance_check && linkData.maintenance_check.logbook_links) {
                                    links = linkData.maintenance_check.logbook_links;
                                }
                                // Build list: each available logbook with isLinked flag
                                vm.check_logbook_links = available.map(function(lb) {
                                    var isLinked = links.some(function(link) {
                                        return link.logbook_type === lb.logbook_type &&
                                               link.logbook_entity_id == lb.logbook_entity_id;
                                    });
                                    return {
                                        logbook_type: lb.logbook_type,
                                        logbook_entity_id: lb.logbook_entity_id,
                                        label: lb.label,
                                        position: lb.position || null,
                                        isLinked: isLinked
                                    };
                                });
                            }, function() {
                                vm.check_logbook_loading = false;
                                vm.check_logbook_error = true;
                            });
                    }, function() {
                        vm.check_logbook_loading = false;
                        vm.check_logbook_error = true;
                    });
            };

            // Load linked workpack detail
            vm.loadCheckWorkpack = function(log) {
                var d = log.maintenance_check || {};
                var wpId = d.linked_workpack_id || d.workpack_id || null;
                if (!wpId) return;
                vm.check_workpack_loading = true;
                WorkpackService.GetById(wpId)
                    .then(function(data) {
                        vm.check_workpack_loading = false;
                        if (data && data.workpack) {
                            vm.check_workpack = data.workpack;
                        }
                    }, function() {
                        vm.check_workpack_loading = false;
                    });
            };

            vm.downloadWorkpackDocument = function(filename) {
                if (!filename) return;
                $http.get('/api/v1/maintenance_workpacks/file/' + filename, {
                    responseType: 'arraybuffer'
                }).success(function(data, status, headers) {
                    var blob = new Blob([data], { type: 'application/pdf' });
                    var fileURL = URL.createObjectURL(blob);
                    var prntWin = window.open();
                    prntWin.document.write('<html><head><title>Workpack Document</title></head><body>'
                        + '<embed width="100%" height="100%" name="plugin" src="' + fileURL + '" '
                        + 'type="application/pdf" internalinstanceid="21"></body></html>');
                    prntWin.document.close();
                }).error(function() {
                    ToastService.error('Download Error', 'There was an error downloading the workpack document.');
                });
            };

            vm.getLogbookIcon = function(type) {
                switch (type) {
                    case 'airframe': return 'fa-plane';
                    case 'engine': return 'fa-cog';
                    case 'propeller': return 'fa-refresh';
                    default: return 'fa-book';
                }
            };

            vm.getCheckTypeIcon = function(type) {
                if (!type) return 'fa-wrench';
                switch (type.toLowerCase()) {
                    case 'annual': return 'fa-calendar-check-o';
                    case '50hours': case '50hour': case '25hours': case '100hours': case '100hour': case '150hour': return 'fa-tachometer';
                    case 'extension': return 'fa-clock-o';
                    case 'interim': return 'fa-cogs';
                    case '6months': return 'fa-calendar';
                    case 'cofa': case 'arc': return 'fa-certificate';
                    case 'engine_overhaul': return 'fa-cog';
                    case 'propeller_overhaul': return 'fa-repeat';
                    case 'workpack': return 'fa-briefcase';
                    default: return 'fa-wrench';
                }
            };

            vm.update_logbooks = function(){
                

                PlaneService.UpdateAircraftLogbooks($stateParams.plane_id)
                .then(function (data) {
                        
                        if(data.success){

                           PlaneService.GetPropLogs($stateParams.prop_id, $stateParams.plane_id, 0, 25)
                            .then(function (data) {
                                    // //console.log("ALL is : ", data);
                                   vm.logs = data.logs;
                                   vm.propeller = data.propeller;


                                });

                        }


                    });
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
                PlaneDocumentService.Delete(vm.user_id, file.id)
                .then(function (data) {
                    // //console.log(data);
                    if(data.success){
                        // //console.log("HUZZAH", current_files);
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
            // //console.log("REMOVE: ", j);
            // //console.log("REMOVE: ", j.saved_url);

            //to delete the temp file created: j.saved_url
            //tmp_rm.php POST tmp = filename
            

            //this SHOULD BE TO THE CURRENT POSITION

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
          

          // $scope.$on('flow::fileAdded', function (event, $flow, flowFile) {
          //     event.preventDefault();//prevent file from uploading
          //     //console.log("FILE ADDED");
          //     //console.log($flow);
          //   });

            vm.files = {
                radio: [],
                cert: [],
                insurance: []
            }


            $scope.processFiles = function(files, location){
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
                    vm.files[location].push(files[i].file);
                }


            }


             $scope.processFile = function(files, location){
                 //console.log("files", files[0].file_return);

                    // //console.log("JSON", files[i].file_return);
                    var j = JSON.parse(files[0].file_return);
                    // //console.log("PARSED", j);
                    // //console.log("J is : ",j);
                    // //console.log("name is : ", j.files.file.name);

                    files[0].file.temp_path = j.saved_url;
                    files[0].file.save_name = j.files.file.name;

                    var ft = j.files.file.name;
                    // //console.log("ft", ft);
                    var fft = ft.split('.').pop();
                    files[0].file.extension = fft;
                    // //console.log("FILE is : ", files[0]);

                    // //console.log("file", files[i].file);
                    vm.files[location].push(files[0]);


            }

            $scope.set_title = function(file){
                // //console.log("return", file);
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
                ////console.log("FILE", file);
                if(!file || file == ""){
                    return "";
                }
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


            vm.defect_severity;
                vm.defect_severities = [
                    { title: "No Fly Item - Ground the plane"},
                    { title: "Flyable - needs to be checked at next maintenance"},
                    { title: "Not urgent - but needs noting"},
                    { title: "Unsure of severity"}
                ]; 


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

               
              

                // //console.log("plane_documents: ", vm.plane_documents);


                //compile the required elements YAY

                // //console.log("plane_document ", vm.plane_document);


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


          //var warning_msg = "By deleting this plane, you will also cancel all reservations that this plane currently has."

          // $scope.open = function (plane_id) {
          //   var modalInstance = $uibModal.open({
          //     animation: true,
          //     templateUrl: 'views/modals/deleteModal.html',
          //     controller: 'ModalInstanceCtrl',
          //     //params: {},
          //     size: "lg",
          //     resolve: {
          //       id: function () {
          //         return plane_id;
          //       },
          //       warning: function(){
          //           return warning_msg;
          //       }
          //     }
          //   });
          //   modalInstance.result.then(function (plane_id) {
          //     $log.info('PRESSED GO: '+plane_id);
          //     PlaneService.Delete(plane_id)
          //     .then(function(){
          //       //console.log("HELLO DELETE");
          //       //update view?
          //        vm.club.planes = $.grep(vm.club.planes, function(e){ 
          //           return e.plane_id != plane_id; 
          //       });
          //     })
          //   }, function () {
          //     $log.info('Modal dismissed at: ' + new Date());
          //   });
          // };

            $scope.open = function (club_plane_id) {
            var modalInstance = $uibModal.open({
              animation: true,
              templateUrl: 'views/modals/deleteModal.html',
              controller: 'ModalInstanceCtrl',
              size: "lg",
              resolve: {
                id: function () {
                  return club_plane_id;
                },
                params: function() {
                  return {id: club_plane_id};
                },
                warning: function(){
                    return warning_msg;
                }
              }
            });
            modalInstance.result.then(function (plane) {
                var id = plane.id;
              $log.info('PRESSED GO: ', id);
              
              PlaneService.Delete(id)
              .then(function(){
                // //console.log("HELLO DELETE");
                //update view?
                 vm.club.planes = $.grep(vm.club.planes, function(e){ 
                    return e.id != id; 
                });
             });

            }, function () {
              $log.info('Modal dismissed at: ' + new Date());
            });


          };
         
          


        //   $scope.downloadCertificate = function(doc) {
        //     var data = $.param({
        //         id: doc
        //     });

        //     var ddd = doc.replace(/^.*[\\\/]/, '');

        //     $http.get('api/v1/plane_certificate/show_file/'+ddd, {
        //             responseType: 'arraybuffer'
        //         })
        //         .success(function(data, status, headers) {
        //             var zipName = processArrayBufferToBlob(data, headers);

        //             //Delete file from temp folder in server - file needs to remain open until blob is created
        //             //deleteFileFromServerTemp(zipName);
        //         }).error(function(data, status) {
        //             alert("There was an error downloading the selected document(s).");
        //         })
        // };


        // $scope.downloadInsurance = function(doc) {
        //     var data = $.param({
        //         id: doc
        //     });

        //     var ddd = doc.replace(/^.*[\\\/]/, '');

        //     $http.get('api/v1/plane_insurance/show_file/'+ddd, {
        //             responseType: 'arraybuffer'
        //         })
        //         .success(function(data, status, headers) {
        //             var zipName = processArrayBufferToBlob(data, headers);

        //             //Delete file from temp folder in server - file needs to remain open until blob is created
        //             //deleteFileFromServerTemp(zipName);
        //         }).error(function(data, status) {
        //             alert("There was an error downloading the selected document(s).");
        //         })
        // };




        $scope.downloadDocument = function(doc, type = 'docs') {
            var data = $.param({
                id: doc
            });

            var controller = "plane_documents";

            switch(type){
                 case "radio": 
                    controller = "plane_radio_licence";
                break;
                 case "insurance": 
                    controller = "plane_insurance";
                break;
                 case "certificate": 
                    controller = "plane_certificate";
                break;
                case "noise": 
                    controller = "plane_noise_certificate";
                break;
                case "docs": 
                    controller = "plane_documents";
                break;
                default:
                    controller = "plane_documents";
                break;

            }



            var ddd = doc.replace(/^.*[\\\/]/, '');

            $http.get('api/v1/'+controller+'/show_file/'+ddd, {
                    responseType: 'arraybuffer'
                })
                .success(function(data, status, headers) {
                    var zipName = processArrayBufferToBlob(data, headers);

                    //Delete file from temp folder in server - file needs to remain open until blob is created
                    //deleteFileFromServerTemp(zipName);
                }).error(function(data, status) {
                    ToastService.error('Download Failed', 'There was an error downloading the selected document(s).');
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
                    ToastService.error('Download Failed', 'There was an error downloading the selected document(s).');
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



        $scope.search2 = function(row){
            //(angular.lowercase(row.first_name).indexOf(angular.lowercase($scope.my_search2) || '') !== -1)  || (angular.lowercase(row.last_name).indexOf(angular.lowercase($scope.my_search2) || '') !== -1)
            ////console.log("answer", (angular.lowercase(row.flight_date).indexOf(angular.lowercase($scope.my_search2) || '') !== -1));
            // return ((angular.lowercase(row.flight_date).indexOf(angular.lowercase($scope.my_search2) || (angular.lowercase(row.flight_time).indexOf(angular.lowercase($scope.my_search2)) || '') !== -1)));
            //(angular.lowercase(row.flight_date).indexOf(angular.lowercase($scope.my_search2) || '') !== -1)
           
            // if( (test_date($scope.my_search2, row.flight_date)) || (angular.lowercase(row.destination_airport).indexOf(angular.lowercase($scope.my_search2) || '') !== -1) || (angular.lowercase(row.departure_airport).indexOf(angular.lowercase($scope.my_search2) || '') !== -1) || (angular.lowercase(row.destination_airport_code).indexOf(angular.lowercase($scope.my_search2) || '') !== -1) || (angular.lowercase(row.departure_airport_code).indexOf(angular.lowercase($scope.my_search2) || '') !== -1)){
            //     return true;
            // } else {
            //     return false;
            // }test_aircraft

            //console.log("TEST " , test_date($scope.my_search2));

            ////console.log($scope.my_search2);
            if(!$scope.my_search2 || ($scope.my_search2 == "")){
                return true;
            } else if(test_date($scope.my_search2, row.entry_date)){
                return true;
            } else {
                return false;
            }

            // we are testing for the date, the pilot, the departure and destination.

            // return (angular.lowercase(row.flight_date).indexOf(angular.lowercase($scope.my_search2) || '') !== -1); // ? (angular.lowercase(row.flight_date).indexOf(angular.lowercase($scope.my_search2) || '') !== -1) : (angular.lowercase(row.flight_time).indexOf(angular.lowercase($scope.my_search2) || '') !== -1);

        };

        function test_date(search, date){


            if(search.length < 2){
                return false;
            }

            if(search && search.length <= 3){
                if(date.indexOf(search) > -1){
                    return true;
                }
            } else {
                var parsed_date = "";
                var b = moment(search);
                if(b.isValid() && b.format("YYYY") != "2001"){
                    parsed_date = b.format("YYYY-MM-DD");
                } else if(b.isValid()){
                    parsed_date = b.format("MM-DD");
                }


                var search_type = 0;

                if(parsed_date !== "" && date.indexOf(parsed_date) > -1){
                    // //console.log("found");
                    return true;
                } else {

                    //backup in case of wrong parsing data::;
                    //european method

                    if(search.length <= 5 && search.length >= 4){

                        var c = moment(search, "DDMM");
                        // //console.log("C is : ", c);
                        if(c.isValid()){
                            var c2 = c.format("MM-DD");
                            if(date.indexOf(c2) > -1){
                                return true;
                            }
                        }

                    } else if(search.length == 8 || search.length == 10){
                        
                        var c = moment(search, "DDMMYYYY");
                        // //console.log("C is : ", c);
                        if(c.isValid()){
                            var c2 = c.format("YYYY-MM-DD");
                            if(date.indexOf(c2) > -1){
                                return true;
                            }
                        }

                    }

                    // //console.log("not found");
                    return false;
                }
            }

        }

        $scope.getMySearchCount = function(str){
            var docs = str.documents;
            var total = 0;
            for(var i=0;i<docs.length;i++){
                if($scope.search(docs[i])){
                    total++;
                }
            }
            return total;
        }

        $scope.getMySearchCount2 = function(str){
            var charges = str.charges;
            var total = 0;
            for(var i=0;i<charges.length;i++){
                if($scope.search(charges[i])){
                    total++;
                }
            }
            return total;
        }


    }