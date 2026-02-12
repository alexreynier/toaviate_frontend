 app.controller('DashboardClubMaintenanceController', DashboardClubMaintenanceController);

    DashboardClubMaintenanceController.$inject = ['UserService', 'PlaneService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'LicenceService', 'MedicalService', 'DifferencesService', 'PlaneDocumentService', 'FoxService', '$http', 'WorkpackService', 'CrsService', 'LogbookLinkService', 'ToastService'];
    function DashboardClubMaintenanceController(UserService, PlaneService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, LicenceService, MedicalService, DifferencesService, PlaneDocumentService, FoxService, $http, WorkpackService, CrsService, LogbookLinkService, ToastService) {
        var vm = this;

        vm.user = null;
        vm.allUsers = [];
        vm.club = {
            plane: {
                requirements: {
                    licence: [],
                    medical: [],
                    differences: []
                },
                documents: []
            }
        };

        vm.page_title = "";
        
        vm.plane_document = {};
        vm.plane_documents = [];

        var update_this_file = [];
        
        
        vm.currency_types = ["class", "type"];
        vm.gear_types = ["tricycle", "tailwheel", "monowheel", "floats", "skis"];

        vm.charge_type = ["brakes", "tacho", "hobbs"];
        vm.surcharge_type = ["none", "flight", "hour"];

        // Determine action from stateParams rather than $state.current.data.action,
        // because when a child state (e.g. airframe_logbook) is active, $state.current
        // points to the child whose data.action may differ from the parent's.
        vm.action = $stateParams.plane_id ? 'edit' : ($state.current.data.action || 'list');
        vm.user = $rootScope.globals.currentUser;
        // //console.log("$rootScope.globals.currentUser : ", $rootScope.globals.currentUser);
        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user_id = vm.user.id;

        vm.show_overlay = false;
        vm.show_cert = false;
        vm.show_maintenance = false;
        vm.show_radio = false;
        vm.show_noise = false;
        vm.show_insurance = false;
        vm.show_offline = false;
        vm.show_crs = false;
        vm.crs_records = [];

        vm.obj = {
            issues: [],
            issue_confirmation: false
        };

       vm.reported_defects = [];

       vm.maintenance_types = [
        "annual", "25hours", "50hours", "100hours", "interim", "6months", "extension", "workpack"
       ];

       // ── Workpacks ──
       vm.workpacks = [];
       vm.workpack = null;
       vm.open_workpacks = [];
       vm.new_workpack = {};
       vm.show_create_workpack = false;
       vm.show_workpack_detail = false;
       vm.workpack_files = { workpack_doc: [] };
       vm.defect_workpack_files = { defect_wp_doc: [] };
       vm.show_link_defect = false;
       vm.show_link_maintenance = false;
       vm.show_defect_workpack = false;
       vm.selected_defect_for_wp = null;
       vm.defect_wp = {};

       // ── Maintenance Events ──
       vm.maintenance_events = [];
       vm.selected_event = null;
       vm.show_event_detail = false;
       vm.event_filter = 'all';

       // ── Logbook Links ──
       vm.available_logbooks = [];
       vm.event_logbook_links = [];
       vm.logbook_checkboxes = [];
       vm.saving_logbook_links = false;
       vm.logbook_load_error = false;
       vm.create_logbook_checkboxes = [];
       vm.create_logbook_loading = false;
       vm.create_logbook_error = false;

      
        // ── List loading function (called on init and when returning from detail) ──
        function loadMaintenanceList() {
            PlaneService.GetAllByClubMaintenance(vm.club_id)
                .then(function(data){
                    vm.club.planes = data;
                });
        }

        // ── Detail loading function (called on init and when returning from child states) ──
        function loadMaintenanceDetail() {
            PlaneService.GetByIdMaintenance2($stateParams.plane_id, vm.club_id)
                .then(function(data){
                    vm.club.plane = data;  
                    vm.this_plane_id = $stateParams.plane_id; 

                    if(vm.club.plane && vm.club.plane.maintenance){
                        vm.obj.hours_remaining = vm.club.plane.maintenance.hours_remaining;
                        vm.obj.next_check = new Date(vm.club.plane.maintenance.next_maintenance);
                        vm.obj.check_date = new Date();
                        vm.obj.extension_granted = new Date();
                    }

                    vm.page_title = "Edit a Plane Maintenance - "+vm.club.plane.registration;
                });

            PlaneService.GetOpenIssues($stateParams.plane_id)
                .then(function (data) {
                    vm.reported_defects = data;
                });

            WorkpackService.GetByPlane($stateParams.plane_id)
                .then(function (data) {
                    if (data.success !== false) {
                        vm.workpacks = data.workpacks || [];
                    }
                });

            WorkpackService.GetOpenByPlane($stateParams.plane_id)
                .then(function (data) {
                    if (data.success !== false) {
                        vm.open_workpacks = data.workpacks || [];
                    }
                });

            PlaneService.GetMaintenanceEvents($stateParams.plane_id)
                .then(function (data) {
                    if (data && data.maintenance_events) {
                        vm.maintenance_events = data.maintenance_events;
                    } else if (data && data.events) {
                        vm.maintenance_events = data.events;
                    } else if (Array.isArray(data)) {
                        vm.maintenance_events = data;
                    }
                });
        }

        switch(vm.action){
            case "add":
                // //console.log("adding a new plane please");
                vm.page_title = "Add a New Plane";
            break;
            case "edit":
                // //console.log("edit an existing plane");
                
                loadMaintenanceDetail();

                // Reload data when navigating back from child states (e.g. logbook pages)
                var deregisterStateChange = $scope.$on('$stateChangeSuccess', function(event, toState) {
                    if (toState.name === 'dashboard.manage_club.maintenance.detail') {
                        loadMaintenanceDetail();
                    }
                });
                $scope.$on('$destroy', deregisterStateChange);


               


            break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                loadMaintenanceList();

                // Reload list when navigating back from child states (e.g. detail page)
                var deregisterListChange = $scope.$on('$stateChangeSuccess', function(event, toState) {
                    if (toState.name === 'dashboard.manage_club.maintenance') {
                        loadMaintenanceList();
                    }
                });
                $scope.$on('$destroy', deregisterListChange);
            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  

        vm.reset_aeroplane = function(){
            if(vm.this_plane_id && vm.this_plane_id > 0){
                var a = confirm("Are you sure you wish to override the logs?");
                if(a){
                    FoxService.ResetOneClubPlane(vm.this_plane_id)
                    .then(function(data){
                        console.log(data);
                        if(data.success){
                            ToastService.success('Reset Complete', 'Logbooks have been re-checked.');
                        }  
                        // //console.log(vm.club.planes);
                    });
                } else {
                    //ignore for now
                }
            } else {
                ToastService.error('Error', 'An unexpected error occurred.');
            }
        }

        //'9' needs to refer the the user's account set to manage
        vm.selected_type = "";
        vm.send_obj = {};
        $scope.show_overlay = function(type){
        
            vm.show_overlay = true;
            
            vm.selected_type = type;

            if(type == "maintenance"){
                vm.show_cert = true;
                vm.show_insurance = true;
                vm.show_radio = true;
                vm.show_maintenance = true;
                vm.show_noise = true;
                vm.show_crs = true;
                vm.show_offline = false;
                // Default new workpack status to 'completed'
                vm.new_workpack = { status: 'completed' };
                vm.workpack_files = { workpack_doc: [] };
                // Load available logbooks for the checkbox section
                vm.loadCreateLogbooks();
            } else if(type == "crs"){
                vm.show_cert = false;
                vm.show_insurance = false;
                vm.show_radio = false;
                vm.show_maintenance = false;
                vm.show_noise = false;
                vm.show_crs = true;
                vm.show_offline = false;
            } else if(type == "cert"){
                vm.show_cert = true;
                vm.show_insurance = false;
                vm.show_radio = false;
                vm.show_maintenance = false;
                vm.show_noise = false;
                vm.show_crs = false;
                vm.show_offline = false;
            } else if(type == "insurance"){
                vm.show_cert = false;
                vm.show_insurance = true;
                vm.show_radio = false;
                vm.show_maintenance = false;
                vm.show_noise = false;
                vm.show_crs = false;
                vm.show_offline = false;
            } else if(type == "radio"){
                vm.show_cert = false;
                vm.show_insurance = false;
                vm.show_radio = true;
                vm.show_maintenance = false;
                vm.show_noise = false;
                vm.show_crs = false;
                vm.show_offline = false;
            } else if(type == "noise"){
                vm.show_cert = false;
                vm.show_insurance = false;
                vm.show_radio = false;
                vm.show_maintenance = false;
                vm.show_noise = true;
                vm.show_crs = false;
                vm.show_offline = false;
            } else if(type == "offline"){
                vm.show_cert = false;
                vm.show_insurance = false;
                vm.show_offline = true;
                vm.show_radio = false;
                vm.show_noise = false;
                vm.show_crs = false;
                vm.show_maintenance = false;
            } 

            

       }

       $scope.close_overlay = function(){
            vm.show_overlay = false;

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



        $scope.filter_detail = function(show_all = 0){
                return (show_all == 0) ? {status: "open"} : {};
            }

            $scope.count_defects = function(defects, show_all = 0){

               var counter = 0;

               for(var i=0;i<defects.length;i++){
                   if(show_all == 1){
                       counter++;
                   } else {
                       if(defects[i].status == "open"){
                           counter++;
                       }
                   }
               }

               return counter;

           }




        $scope.save_overlay = function(){

            //first we save stuff   

           
            

            var save = vm.obj;
            
            // //console.log("FILES ARE ", vm.files);

            save.files = {
                radio: (vm.files.radio[0]) ? vm.files.radio[0].file : {},
                cert: (vm.files.cert[0]) ? vm.files.cert[0].file : {},
                noise_cert: (vm.files.noise_cert[0]) ? vm.files.noise_cert[0].file : {},
                insurance: (vm.files.insurance[0]) ? vm.files.insurance[0].file : {}
            }

            var send_update = false;


            save.selected_type = vm.selected_type;

            var send_obj = {};

            if(vm.one_ticked){
               for(var i=0;i<vm.reported_defects.length;i++){
                if(vm.reported_defects[i].resolved){
                    vm.obj.issues.push(vm.reported_defects[i]);
                }
               } 
               send_obj.issues = vm.obj.issues;
               if(send_obj.issues.length > 0){
                   send_update = true;
               }
            }

            if((vm.files.radio[0] && vm.obj.radio_expiry == null) || (!vm.files.radio[0] && vm.obj.radio_expiry)){
                ToastService.warning('Radio Incomplete', 'Please add both the expiry date and the new certificate.');
                return false;
            } else if(vm.files.radio[0] && vm.obj.radio_expiry){
                send_obj.radio = {
                    file: (vm.files.radio[0]) ? vm.files.radio[0].file : {},
                    expiry: vm.obj.radio_expiry
                };
                send_update = true;
            }

            // //console.log("radio file ", vm.files.radio[0]);


            if((vm.files.cert[0] && vm.obj.certificate_expiry == null) || (vm.files.cert[0] == null && vm.obj.certificate_expiry)){
                ToastService.warning('Certificate Incomplete', 'Please add both the expiry date and the new certificate.');
                return false;
            } else if(vm.files.cert[0] && vm.obj.certificate_expiry) {
                send_obj.cert = {
                    file: (vm.files.cert[0]) ? vm.files.cert[0].file : {},
                    expiry: vm.obj.certificate_expiry,
                    date_issued: vm.obj.certificate_issue
                }
                send_update = true;
            }

            // //console.log("insurance file ", vm.files.insurance[0]);

            if((vm.files.insurance[0] && !vm.obj.insurance_expiry) || (vm.files.insurance[0] == null && vm.obj.insurance_expiry)){
                ToastService.warning('Insurance Incomplete', 'Please add both the expiry date and the new certificate.');
                return false;
            } else if(vm.files.insurance[0] && vm.obj.insurance_expiry) {
                send_obj.insurance = {
                    file: (vm.files.insurance[0]) ? vm.files.insurance[0].file : {},
                    expiry: vm.obj.insurance_expiry
                }
                send_update = true;
            }



            if((vm.files.noise_cert[0] && !vm.obj.noise_date) || (vm.files.noise_cert[0] == null && vm.obj.noise_date)){
                ToastService.warning('Noise Certificate Incomplete', 'Please add both the date and the certificate, or leave both empty.');
                return false;
            } else if(vm.files.noise_cert[0] && vm.obj.noise_date) {
                send_obj.noise_cert = {
                    file: (vm.files.noise_cert[0]) ? vm.files.noise_cert[0].file : {},
                    noise_level: vm.obj.noise_level,
                    date_issued: vm.obj.noise_date
                }
                send_update = true;
            }


            // ── CRS (Certificate of Release to Service) ──
            if (vm.files.crs[0]) {
                if (!vm.obj.crs_release_date || !vm.obj.crs_release_time) {
                    ToastService.warning('CRS Incomplete', 'Please add the release date, release time, and the certificate.');
                    return false;
                }
                // CRS uses its own endpoint, not AddMaintenance
                var crsPayload = {
                    plane_id: parseInt(vm.this_plane_id),
                    release_date: moment(vm.obj.crs_release_date).format('YYYY-MM-DD'),
                    release_time: moment(vm.obj.crs_release_time).format('HH:mm:ss'),
                    file: vm.files.crs[0].file
                };
                send_obj.crs = crsPayload;
                send_update = true;
            } else if (vm.obj.crs_release_date || vm.obj.crs_release_time) {
                ToastService.warning('CRS Incomplete', 'Please upload the certificate document along with the release date and time.');
                return false;
            }


            // //console.log("type:", vm.obj.maintenance_type);
            // //console.log("remaining:", vm.obj.hours_remaining);
            // //console.log("next_check:", vm.obj.next_check);
           


            // //console.log("firs: ", (vm.obj.maintenance_type !== undefined 
            //  || vm.obj.hours_remaining !== undefined 
            //  || vm.obj.next_check !== undefined));

            // //console.log("secon: ",((vm.obj.maintenance_type !== "" || vm.obj.maintenance_type !== undefined) && (vm.obj.hours_remaining !== undefined || vm.obj.hours_remaining !== "") 
            //     && (vm.obj.next_check !== undefined && vm.obj.next_check !== "")) );
          
            // Only validate maintenance fields when the maintenance overlay is active
            if(vm.show_maintenance){

              // ── Validate required fields before proceeding ──
              // 1. Maintenance type must be selected
              if (!vm.obj.maintenance_type || vm.obj.maintenance_type === '') {
                  ToastService.warning('Maintenance Type Required', 'Please select a maintenance type.');
                  return false;
              }

              // 2. Time of maintenance must be filled
              if (!vm.obj.check_time) {
                  ToastService.warning('Time Required', 'Please enter the time of maintenance.');
                  return false;
              }

              // 3. Checked by must be filled
              if (!vm.obj.checked_by || vm.obj.checked_by.trim() === '') {
                  ToastService.warning('Checked By Required', 'Please enter who checked/signed off the maintenance.');
                  return false;
              }

              // 4. For non-extension types, date of maintenance must be filled
              if (vm.obj.maintenance_type !== 'extension' && !vm.obj.check_date) {
                  ToastService.warning('Date Required', 'Please enter the date of maintenance.');
                  return false;
              }

              // 5. For extension types, extension granted date must be filled
              if (vm.obj.maintenance_type === 'extension' && !vm.obj.extension_granted) {
                  ToastService.warning('Date Required', 'Please enter the extension granted date.');
                  return false;
              }

              if(((vm.obj.maintenance_type !== undefined && vm.obj.maintenance_type !=="extension") 
               || vm.obj.hours_remaining !== undefined 
               || vm.obj.next_check !== undefined)){
                      if((vm.obj.maintenance_type !== "" || vm.obj.maintenance_type !== undefined) && (vm.obj.hours_remaining !== undefined || vm.obj.hours_remaining !== "") 
                  && (vm.obj.next_check !== undefined && vm.obj.next_check !== "")){

                      var check_date =  moment( moment(vm.obj.check_date).format("YYYY-MM-DD")+ " "+moment(vm.obj.check_time).format("HH:mm:ss") ).format("YYYY-MM-DD HH:mm:ss");

                      send_obj.maintenance = {
                          maintenance_type: vm.obj.maintenance_type,
                          hours_remaining: vm.obj.hours_remaining,
                          check_date: check_date,
                          expiry_date: vm.obj.next_check,
                          checked_by: vm.obj.checked_by,
                          description: vm.obj.notes
                      } 

                      // Include workpack_id if selected from existing
                      if (vm.obj.workpack_option === 'existing' && vm.obj.workpack_id) {
                          send_obj.maintenance.workpack_id = parseInt(vm.obj.workpack_id);
                      }

                      send_update = true;
                  } else {
                      ToastService.warning('Maintenance Incomplete', 'Please add check date, next check, and hours remaining.');
                      return false; 
                  }
                }

                if(vm.obj.maintenance_type == "extension"){
                      if((vm.obj.extension_hours !== "" || vm.obj.extension_days !== "")){

                      var extension_granted =  moment( moment(vm.obj.extension_granted).format("YYYY-MM-DD")+ " "+moment(vm.obj.check_time).format("HH:mm:ss") ).format("YYYY-MM-DD HH:mm:ss");


                      send_obj.extension = {
                          maintenance_type: vm.obj.maintenance_type,
                          extension_hours: vm.obj.extension_hours,
                          extension_days: vm.obj.extension_days,
                          extension_granted: extension_granted,
                          description: vm.obj.notes
                      } 
                      send_update = true;
                  } else {
                      ToastService.warning('Maintenance Incomplete', 'Please add check date, next check, and hours remaining.');
                      return false; 
                  }
                }
            }


            // Only validate offline fields when the offline overlay is active
            if(vm.show_offline){
              if((vm.obj.offline_until !== "" || vm.obj.offline_notes !== "")){
                    send_obj.offline = {
                        offline_until: vm.obj.offline_until,
                        offline_notes: vm.obj.offline_notes,
                        club_id: vm.club_id
                    } 
                    send_update = true;
                } else {
                    ToastService.warning('Offline Date', 'Please ensure the offline date is set in the future.');
                    return false; 
              }
            }

            // var send_obj = {
            //     radio: {
            //         file: (vm.files.radio[0]) ? vm.files.radio[0].file : {},
            //         expiry: vm.obj.radio_expiry
            //     },
            //     cert: {
            //         file: (vm.files.cert[0]) ? vm.files.cert[0].file : {},
            //         expiry: vm.obj.certificate_expiry
            //     },
            //     insurance: {
            //         file: (vm.files.insurance[0]) ? vm.files.insurance[0].file : {},
            //         expiry: vm.obj.insurance_expiry
            //     },
            //     maintenance: {
            //         maintenance_type: vm.obj.maintenance_type,
            //         hours_remaining: vm.obj.hours_remaining,
            //         next_check: vm.obj.next_check
            //     },
            //     issues: vm.obj.issues
            // };
            // //console.log("TIME NOW : ", vm.obj.check_date);
            // //console.log("TIME NOW : ", moment(vm.obj.check_date) );
            // //console.log("TIME NOW : ", vm.obj.check_time);
            // //console.log("TIME NOW : ", moment(vm.obj.check_time));

            // //console.log("TIME NOW : ", moment( moment(vm.obj.check_date).format("YYYY-MM-DD")+ " "+vm.obj.check_time ) );


            // return false;

            if(!send_update){
                ToastService.warning('Nothing Saved', 'No changes were made — the panel will close.');

            } else {
                // //console.log("TOSAVE: ", send_obj);
                
                vm.send_obj = send_obj;

                // Helper: save defect workpack info for resolved defects
                // If workpackId is provided, defects marked with _link_to_workpack will be
                // linked to that workpack instead of getting standalone workpack fields.
                var saveDefectWorkpacks = function (workpackId) {
                    if (vm.reported_defects && vm.reported_defects.length > 0) {
                        for (var d = 0; d < vm.reported_defects.length; d++) {
                            var def = vm.reported_defects[d];
                            if (def.resolved) {
                                // Link defect to the new workpack if user chose that option
                                if (workpackId && def._link_to_workpack) {
                                    WorkpackService.LinkDefect(workpackId, def.id);
                                } else if (def.defect_workpack_number || def.defect_workpack_signatory || def._uploaded_file) {
                                    // Standalone workpack info
                                    var payload = {
                                        workpack_number: def.defect_workpack_number || '',
                                        signatory: def.defect_workpack_signatory || ''
                                    };
                                    if (def._uploaded_file) {
                                        payload.document_temp_path = def._uploaded_file.temp_path;
                                        payload.document_extension = def._uploaded_file.extension;
                                        payload.document_original_name = def._uploaded_file.name;
                                    }
                                    WorkpackService.UpdateDefectWorkpack(def.id, payload);
                                }
                            }
                        }
                    }
                };

                // Helper: also create CRS if one was provided
                var saveCrs = function () {
                    if (send_obj.crs) {
                        return CrsService.Create(send_obj.crs);
                    }
                    // Return resolved promise if no CRS
                    return { then: function (cb) { cb({}); } };
                };

                // Create maintenance event first, then workpack if needed
                PlaneService.AddMaintenance(vm.this_plane_id, send_obj)
                    .then(function (data) {

                        // Save CRS alongside (fire and forget alongside workpack)
                        saveCrs();

                        // Save logbook links for the new maintenance check (fire and forget)
                        if (data.maintenance_check_id) {
                            vm.saveCreateLogbookLinks(data.maintenance_check_id);
                        }

                        // If creating a new workpack, do it AFTER the maintenance event is created
                        // so we can associate the workpack with the new maintenance_check_id
                        if (vm.obj.workpack_option === 'new' && vm.new_workpack.workpack_number) {
                            var wp = {
                                club_id: vm.club_id,
                                plane_id: parseInt(vm.this_plane_id),
                                workpack_number: vm.new_workpack.workpack_number,
                                authorised_signatory: vm.new_workpack.authorised_signatory,
                                description: vm.new_workpack.description,
                                status: vm.new_workpack.status || 'completed',
                                created_by_user_id: vm.user_id
                            };

                            // Link to the maintenance event that was just created
                            if (data.maintenance_check_id) {
                                wp.maintenance_check_id = data.maintenance_check_id;
                            }

                            if (vm.workpack_files.workpack_doc && vm.workpack_files.workpack_doc.length > 0) {
                                var f = vm.workpack_files.workpack_doc[0];
                                wp.document_temp_path = f.temp_path;
                                wp.document_extension = f.extension;
                                wp.document_original_name = f.name;
                            }

                            WorkpackService.Create(wp)
                                .then(function (wpData) {
                                    if (wpData.success) {
                                        // Link resolved defects to this workpack or save standalone info
                                        saveDefectWorkpacks(wpData.id);
                                        vm.new_workpack = {};
                                        vm.workpack_files = { workpack_doc: [] };
                                        $state.go('dashboard.manage_club.maintenance.detail', {plane_id: vm.this_plane_id}, {reload: true});
                                    } else {
                                        ToastService.error('Workpack Error', wpData.message || 'Unknown error');
                                        $state.go('dashboard.manage_club.maintenance.detail', {plane_id: vm.this_plane_id}, {reload: true});
                                    }
                                });
                        } else {
                            // No new workpack — save standalone defect workpack info
                            saveDefectWorkpacks();
                            $state.go('dashboard.manage_club.maintenance.detail', {plane_id: vm.this_plane_id}, {reload: true});
                        }
                    });

            }


            //EASYPEASY LEMON SQUEEEEEZY

            ////console.log("SAVE CERT");
            vm.show_overlay = false;
        }



        $scope.check_ticked = function(){
            var count = 0;
            for(var i=0;i<vm.reported_defects.length;i++){
                if(vm.reported_defects[i].resolved){
                    count++;
                }
            }

            ////console.log("total = ", count);

            vm.one_ticked = (count > 0)? true : false;

            // if(count > 0){
            //     vm.one_ticked = true;
            // } else {
            //     vm.one_ticked = false;
            // }
        }




        $scope.show_cert = function(){
            //console.log("SHOW CERT HERE");
            vm.show_cert = true;

        }

        $scope.close_cert = function(){
            //console.log("CLOSE CERT");
            vm.show_cert = false;
        }

        $scope.save_cert = function(){

            //first we save stuff   





            //console.log("SAVE CERT");
            vm.show_cert = false;
        }


        $scope.show_insurance = function(){
            //console.log("SHOW INSURANCE HERE");
            vm.show_insurance = true;

        }

        $scope.close_insurance = function(){
            //console.log("CLOSE INSURANCE");
            vm.show_insurance = false;
        }

        $scope.save_insurance = function(){

            //first we save stuff   
            


            

            //console.log("SAVE INSURANCE");
            vm.show_insurance = false;
        }



        $scope.show_radio = function(){
            //console.log("SHOW radio HERE");
            vm.show_radio = true;

        }

        $scope.close_radio = function(){
            //console.log("CLOSE radio");
            vm.show_radio = false;
        }

        $scope.save_radio = function(){

            //first we save stuff   
            


            

            //console.log("SAVE radio");
            vm.show_radio = false;
        }

        $scope.show_noise = function(){
            //console.log("SHOW radio HERE");
            vm.show_noise = true;

        }

        $scope.close_noise = function(){
            //console.log("CLOSE radio");
            vm.show_noise = false;
        }

        $scope.save_noise = function(){

            //first we save stuff              
            //console.log("SAVE radio");
            vm.show_noise = false;
        }


        $scope.show_maintenance = function(){
            //console.log("SHOW maintenance HERE");
            vm.show_maintenance = true;

        }

        $scope.close_maintenance = function(){
            //console.log("CLOSE maintenance");
            vm.show_maintenance = false;
        }

        $scope.save_maintenance = function(){

            //first we save stuff   

            //console.log("SAVE maintenance");
            vm.show_maintenance = false;
        }


        vm.add_defect = function(){


                var obj = {
                    club_id: vm.club_id,
                    user_id: vm.user_id,
                    plane_id: vm.this_plane_id,
                    defect: vm.defect,
                    severity: vm.defect_severity.title,
                    status: "open"
                }



                PlaneService.AddDefect(obj)
                 .then(function (data) {
                        ////console.log("data is : ", data);
                        data.item.can_delete = true;

                        //HELLO
                        vm.club.plane.defects.push(data.item);
                        //vm.reported_defects.push(data.item);

                        vm.defect = "";
                        vm.defect_severity = "";



                    });

            }

            vm.delete_defect = function(id){
               // //console.log("UNDO DEFECT ID ", id);

                PlaneService.DeleteDefect(id)
                .then(function (data) {
                        ////console.log("data is : ", data);
                       
                        PlaneService.GetOpenIssues(vm.bookout.plane_id)
                        .then(function (data) {
                                ////console.log("data is : ", data);
                               vm.reported_defects = data;
                            });


                    });

            }



        $scope.back = function(){
            $window.history.back();
        }

        $scope.save = function(){
            if(vm.action == "add"){
                // //console.log("CREATE click");
                $scope.create();
            } else {
                // //console.log("EDIT click");
                // //console.log(vm.club.plane);
                $scope.update();
            }
        }


        $scope.create = function(){
            // //console.log("CREATE ME NOW");
            vm.club.plane.club_id = vm.club_id;
            vm.club.plane.add_documents = vm.plane_documents;
            // //console.log("PLANE TO ADD, ", vm.club.plane);
            //return false;
            PlaneService.Create(vm.club.plane)
                .then(function(data){
                    // //console.log(data);
                    $state.go('dashboard.manage_club.planes', {reload: true});

                });
        }

        $scope.delete = function(){
            // //console.log("CLICK");
            ToastService.warning('Confirm Delete', 'Are you sure you would like to delete this plane?');
            PlaneService.Update(vm.club.plane)
                .then(function(data){
                    // //console.log(data);
                });
        }

        $scope.getColours = function(value){
            if(value < 1){
                return "red";
            }
            if(value < 5){
                return "warning"
            }
            if(value < 10){
                return "amber";
            }
        }

        function get_update_docs(){
            var documents = [];

            for(var i=0;i<update_this_file.length;i++){
                var id = update_this_file[i];
                // //console.log("looking for : ", id);
                // //console.log("in: ", vm.plane_documents);

                for(var k=0;k<vm.club.plane.plane_documents.length;k++){
                    // //console.log("comparing to : ", vm.club.plane.plane_documents[k].id);
                    if(vm.club.plane.plane_documents[k].id == id){
                        documents.push(vm.club.plane.plane_documents[k]);
                    }
                }

            }

            // //console.log("DOCS TO UPDATE : ", documents);

            return documents;
        }

        $scope.update = function(){
            // //console.log("CLICK");
            vm.club.plane.club_id = vm.club_id;
            vm.club.plane.add_documents = vm.plane_documents;

            vm.club.plane.update_documents = get_update_docs();
            //get_update_docs();

            PlaneService.Update(vm.club.plane)
                .then(function(data){
                    // //console.log(data);
                    // //console.log("saved");
                    $state.go('dashboard.manage_club.planes');
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
            // //console.log("ADD");
            switch(type){
                case "licence":
                    // //console.log("licence");
                    if(vm.temporary.licence && vm.temporary.licence !== "" && vm.temporary.rating && vm.temporary.rating !== ""){
                        //then we can add it
                        // //console.log("here we go");
                        var add_licence = {
                            licence_id: vm.temporary.licence.id,
                            licence_title: vm.temporary.licence.abbreviation,
                            rating_title: vm.temporary.rating.abbreviation,
                            rating_id: vm.temporary.rating.id
                        };

                        //check if it doesnt exist first...
                        if(containsObject(add_licence, vm.club.plane.requirements.licence, new Array("licence_id", "rating_id")) == false){
                            vm.club.plane.requirements.licence.push(add_licence);
                        }

                        delete vm.temporary.licence;
                        delete vm.temporary.rating;

                    } else {
                        ToastService.warning('Missing Selection', 'Please select a licence and rating required to book the plane solo.');
                    }

                break;


                case "medical":
                    //console.log("medical");
                    if(vm.temporary.medical_authority && vm.temporary.medical_authority !== "" && vm.temporary.medical_component && vm.temporary.medical_component !== ""){
                        //then we can add it
                        //console.log("here we go");
                        var add_medical = {
                            authority_id: vm.temporary.medical_authority.id,
                            authority_title: vm.temporary.medical_authority.abbreviation,
                            medical_component_id: vm.temporary.medical_component.id,
                            medical_component_title: vm.temporary.medical_component.title
                        };

                        //check if it doesnt exist first...
                        if(containsObject(add_medical, vm.club.plane.requirements.medical, new Array("authority_id", "medical_component_id")) == false){
                            vm.club.plane.requirements.medical.push(add_medical);
                        }

                        delete vm.temporary.medical_authority;
                        delete vm.temporary.medical_component;

                    } else {
                        ToastService.warning('Missing Selection', 'Please select a medical required to book the plane solo.');
                    }

                break;


                case "differences":
                    //console.log("difference");
                    if(vm.temporary.difference && vm.temporary.difference !== ""){
                        //then we can add it
                        //console.log("here we go");
                        var add_difference = {
                            difference_id: vm.temporary.difference.id,
                            difference_title: vm.temporary.difference.title
                        };

                        //check if it doesnt exist first...
                        if(containsObject(add_difference, vm.club.plane.requirements.differences, new Array("difference_id", "difference_title")) == false){
                            vm.club.plane.requirements.differences.push(add_difference);
                        }

                        delete vm.temporary.difference;

                    } else {
                        ToastService.warning('Missing Selection', 'Please select a differences training required to book the plane solo.');
                    }

                break;


            }



        }


        $scope.remove_item = function(type, index){
            //console.log("REMOVE");

            vm.club.plane.requirements[type].splice(index, 1);


            // switch(type){
            //     case "licence":
            //             //console.log("licence");
                   
            //             //check if it doesnt exist first...
            //             // if(containsObject(add_licence, vm.club.plane.requirements.licence, new Array("licence_id", "rating_id")) == false){
            //             //     vm.club.plane.requirements.licence.push(add_licence);
            //             // }

            //             vm.club.plane.requirements.licence.splice(index, 1);
                      
                   

            //     break;


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
                noise_cert: [],
                insurance: [],
                crs: []
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


        // ═══════════════════════════════════════════════
        // WORKPACK METHODS
        // ═══════════════════════════════════════════════

        vm.loadWorkpacks = function () {
            if (!vm.this_plane_id) return;
            WorkpackService.GetByPlane(vm.this_plane_id)
                .then(function (data) {
                    if (data.success !== false) {
                        vm.workpacks = data.workpacks || [];
                    }
                });
        };

        vm.loadOpenWorkpacks = function () {
            if (!vm.this_plane_id) return;
            WorkpackService.GetOpenByPlane(vm.this_plane_id)
                .then(function (data) {
                    if (data.success !== false) {
                        vm.open_workpacks = data.workpacks || [];
                    }
                });
        };

        vm.createWorkpack = function () {
            var wp = {
                club_id: vm.club_id,
                plane_id: parseInt(vm.this_plane_id),
                workpack_number: vm.new_workpack.workpack_number,
                authorised_signatory: vm.new_workpack.authorised_signatory,
                description: vm.new_workpack.description,
                status: vm.new_workpack.status || 'completed',
                created_by_user_id: vm.user_id
            };

            // If a document was uploaded
            if (vm.workpack_files.workpack_doc && vm.workpack_files.workpack_doc.length > 0) {
                var f = vm.workpack_files.workpack_doc[0];
                wp.document_temp_path = f.temp_path;
                wp.document_extension = f.extension;
                wp.document_original_name = f.name;
            }

            WorkpackService.Create(wp)
                .then(function (data) {
                    if (data.success) {
                        vm.show_create_workpack = false;
                        vm.new_workpack = {};
                        vm.workpack_files = { workpack_doc: [] };
                        vm.loadWorkpacks();
                        vm.loadOpenWorkpacks();
                    } else {
                        ToastService.error('Workpack Error', data.message || 'Unknown error');
                    }
                });
        };

        vm.viewWorkpack = function (id) {
            WorkpackService.GetById(id)
                .then(function (data) {
                    if (data.success !== false) {
                        vm.workpack = data.workpack;
                        vm.show_workpack_detail = true;
                    }
                });
        };

        vm.closeWorkpackDetail = function () {
            vm.workpack = null;
            vm.show_workpack_detail = false;
            vm.show_link_defect = false;
            vm.show_link_maintenance = false;
        };

        vm.updateWorkpack = function (field, value) {
            if (!vm.workpack) return;
            var update = {};
            update[field] = value;
            WorkpackService.Update(vm.workpack.id, update)
                .then(function (data) {
                    if (data.success) {
                        vm.viewWorkpack(vm.workpack.id);
                        vm.loadWorkpacks();
                        vm.loadOpenWorkpacks();
                    }
                });
        };

        vm.completeWorkpack = function () {
            if (!vm.workpack) return;
            var a = confirm('Are you sure you want to mark this workpack as completed?');
            if (a) {
                WorkpackService.Update(vm.workpack.id, { status: 'completed' })
                    .then(function (data) {
                        if (data.success) {
                            vm.viewWorkpack(vm.workpack.id);
                            vm.loadWorkpacks();
                            vm.loadOpenWorkpacks();
                        }
                    });
            }
        };

        vm.reopenWorkpack = function () {
            if (!vm.workpack) return;
            WorkpackService.Update(vm.workpack.id, { status: 'open' })
                .then(function (data) {
                    if (data.success) {
                        vm.viewWorkpack(vm.workpack.id);
                        vm.loadWorkpacks();
                        vm.loadOpenWorkpacks();
                    }
                });
        };

        vm.deleteWorkpack = function () {
            if (!vm.workpack) return;
            var a = confirm('Are you sure you want to delete (archive) this workpack? This will unlink all defects and maintenance events.');
            if (a) {
                WorkpackService.Delete(vm.workpack.id)
                    .then(function (data) {
                        if (data.success) {
                            vm.closeWorkpackDetail();
                            vm.loadWorkpacks();
                            vm.loadOpenWorkpacks();
                        }
                    });
            }
        };

        vm.uploadWorkpackDocument = function () {
            if (!vm.workpack) return;
            if (vm.workpack_files.workpack_doc && vm.workpack_files.workpack_doc.length > 0) {
                var f = vm.workpack_files.workpack_doc[0];
                WorkpackService.Update(vm.workpack.id, {
                    document_temp_path: f.temp_path,
                    document_extension: f.extension,
                    document_original_name: f.name
                }).then(function (data) {
                    if (data.success) {
                        vm.workpack_files = { workpack_doc: [] };
                        vm.viewWorkpack(vm.workpack.id);
                    }
                });
            }
        };

        vm.removeWorkpackDocument = function () {
            if (!vm.workpack) return;
            WorkpackService.Update(vm.workpack.id, { remove_document: true })
                .then(function (data) {
                    if (data.success) {
                        vm.viewWorkpack(vm.workpack.id);
                    }
                });
        };

        $scope.downloadWorkpackDocument = function (filename) {
            if (!filename) return;
            $http.get('/api/v1/maintenance_workpacks/file/' + filename, {
                responseType: 'arraybuffer'
            }).success(function (data, status, headers) {
                var zipName = processArrayBufferToBlob(data, headers);
            }).error(function (data, status) {
                ToastService.error('Download Error', 'There was an error downloading the workpack document.');
            });
        };

        // ── Link / Unlink Defects ──

        vm.linkDefectToWorkpack = function (defect_id) {
            if (!vm.workpack || !defect_id) return;
            WorkpackService.LinkDefect(vm.workpack.id, defect_id)
                .then(function (data) {
                    if (data.success) {
                        vm.show_link_defect = false;
                        vm.viewWorkpack(vm.workpack.id);
                    } else {
                        ToastService.error('Link Error', data.message || 'Error linking defect.');
                    }
                });
        };

        vm.unlinkDefect = function (defect_id) {
            if (!defect_id) return;
            var a = confirm('Unlink this defect from the workpack?');
            if (a) {
                WorkpackService.UnlinkDefect(defect_id)
                    .then(function (data) {
                        if (data.success) {
                            vm.viewWorkpack(vm.workpack.id);
                        }
                    });
            }
        };

        // ── Link / Unlink Maintenance Events ──

        vm.linkMaintenanceToWorkpack = function (maintenance_check_id) {
            if (!vm.workpack || !maintenance_check_id) return;
            WorkpackService.LinkMaintenance(vm.workpack.id, maintenance_check_id)
                .then(function (data) {
                    if (data.success) {
                        vm.show_link_maintenance = false;
                        vm.viewWorkpack(vm.workpack.id);
                    } else {
                        ToastService.error('Link Error', data.message || 'Error linking maintenance event.');
                    }
                });
        };

        vm.unlinkMaintenance = function (maintenance_check_id) {
            if (!maintenance_check_id) return;
            var a = confirm('Unlink this maintenance event from the workpack?');
            if (a) {
                WorkpackService.UnlinkMaintenance(maintenance_check_id)
                    .then(function (data) {
                        if (data.success) {
                            vm.viewWorkpack(vm.workpack.id);
                        }
                    });
            }
        };

        // ── Standalone Defect Workpack ──

        vm.openDefectWorkpack = function (defect) {
            vm.selected_defect_for_wp = defect;
            vm.defect_wp = {
                workpack_number: defect.defect_workpack_number || '',
                signatory: defect.defect_workpack_signatory || ''
            };
            vm.show_defect_workpack = true;
        };

        vm.closeDefectWorkpack = function () {
            vm.selected_defect_for_wp = null;
            vm.defect_wp = {};
            vm.defect_workpack_files = { defect_wp_doc: [] };
            vm.show_defect_workpack = false;
        };

        vm.saveDefectWorkpack = function () {
            if (!vm.selected_defect_for_wp) return;

            var payload = {
                workpack_number: vm.defect_wp.workpack_number,
                signatory: vm.defect_wp.signatory
            };

            if (vm.defect_workpack_files.defect_wp_doc && vm.defect_workpack_files.defect_wp_doc.length > 0) {
                var f = vm.defect_workpack_files.defect_wp_doc[0];
                payload.document_temp_path = f.temp_path;
                payload.document_extension = f.extension;
                payload.document_original_name = f.name;
            }

            WorkpackService.UpdateDefectWorkpack(vm.selected_defect_for_wp.id, payload)
                .then(function (data) {
                    if (data.success) {
                        vm.closeDefectWorkpack();
                        // Refresh defects
                        PlaneService.GetByIdMaintenance2(vm.this_plane_id, vm.club_id)
                            .then(function (planeData) {
                                vm.club.plane = planeData;
                            });
                    } else {
                        ToastService.error('Workpack Error', data.message || 'Error saving defect workpack info.');
                    }
                });
        };

        // ── CRS (Certificate of Release to Service) ──

        vm.loadCrs = function () {
            CrsService.GetAll(vm.this_plane_id)
                .then(function (data) {
                    if (data.success) {
                        vm.crs_records = data.plane_crs || [];
                    }
                });
        };

        vm.deleteCrs = function (id) {
            var a = confirm('Are you sure you want to archive this CRS?');
            if (a) {
                CrsService.Delete(id)
                    .then(function (data) {
                        if (data.success) {
                            vm.loadCrs();
                            // Refresh plane data so vm.club.plane.crs updates
                            $state.go('dashboard.manage_club.maintenance.detail', {plane_id: vm.this_plane_id}, {reload: true});
                        }
                    });
            }
        };

        vm.downloadCrs = function (filename) {
            if (!filename) return;
            var url = CrsService.DownloadFile(filename);
            $window.open(url, '_blank');
        };

        // Standalone CRS update (from document table UPDATE button)
        vm.saveCrsStandalone = function () {
            if (!vm.files.crs[0]) {
                ToastService.warning('CRS Missing', 'Please upload the CRS certificate document.');
                return;
            }
            if (!vm.obj.crs_release_date || !vm.obj.crs_release_time) {
                ToastService.warning('CRS Incomplete', 'Please provide both the release date and release time.');
                return;
            }
            var payload = {
                plane_id: parseInt(vm.this_plane_id),
                release_date: moment(vm.obj.crs_release_date).format('YYYY-MM-DD'),
                release_time: moment(vm.obj.crs_release_time).format('HH:mm:ss'),
                file: vm.files.crs[0].file
            };
            CrsService.Create(payload)
                .then(function (data) {
                    if (data.success) {
                        vm.files.crs = [];
                        vm.obj.crs_release_date = null;
                        vm.obj.crs_release_time = null;
                        vm.show_overlay = false;
                        $state.go('dashboard.manage_club.maintenance.detail', {plane_id: vm.this_plane_id}, {reload: true});
                    } else {
                        ToastService.error('CRS Error', data.message || 'Unknown error');
                    }
                });
        };

        $scope.processWorkpackFile = function (files, location) {
            if (!files || files.length === 0) return;
            try {
                var j = JSON.parse(files[0].file_return);
                files[0].file.temp_path = j.saved_url;
                files[0].file.save_name = j.files.file.name;
                var ft = j.files.file.name;
                var fft = ft.split('.').pop();
                files[0].file.extension = fft;

                if (location === 'workpack_doc') {
                    vm.workpack_files.workpack_doc = [files[0].file];
                } else if (location === 'defect_wp_doc') {
                    vm.defect_workpack_files.defect_wp_doc = [files[0].file];
                }
            } catch (e) {
                console.error('Error processing workpack file upload:', e, files[0].file_return);
                ToastService.error('Upload Error', 'There was an error uploading the document. Please try again.');
            }
        };

        // Helper: process file upload for a resolved defect's workpack document
        vm.processDefectFile = function (files, defect) {
            if (!files || files.length === 0) return;
            try {
                var j = JSON.parse(files[0].file_return);
                files[0].file.temp_path = j.saved_url;
                files[0].file.save_name = j.files.file.name;
                var ft = j.files.file.name;
                var fft = ft.split('.').pop();
                files[0].file.extension = fft;
                defect._uploaded_file = files[0].file;
            } catch (e) {
                console.error('Error processing defect file upload:', e, files[0].file_return);
                ToastService.error('Upload Error', 'There was an error uploading the document. Please try again.');
            }
        };

        // ═══════════════════════════════════════════════
        // END WORKPACK METHODS
        // ═══════════════════════════════════════════════

        // ═══════════════════════════════════════════════
        // MAINTENANCE EVENT METHODS
        // ═══════════════════════════════════════════════

        vm.loadMaintenanceEvents = function () {
            if (!vm.this_plane_id) return;
            PlaneService.GetMaintenanceEvents(vm.this_plane_id)
                .then(function (data) {
                    if (data && data.maintenance_events) {
                        vm.maintenance_events = data.maintenance_events;
                    } else if (data && data.events) {
                        vm.maintenance_events = data.events;
                    } else if (Array.isArray(data)) {
                        vm.maintenance_events = data;
                    }
                });
        };

        vm.viewEvent = function (event) {
            vm.selected_event = angular.copy(event);
            // Parse dates for date inputs
            if (vm.selected_event.check_date) {
                vm.selected_event._check_date = new Date(vm.selected_event.check_date);
            }
            if (vm.selected_event.expiry_date) {
                vm.selected_event._expiry_date = new Date(vm.selected_event.expiry_date);
            }
            if (vm.selected_event.check_date) {
                vm.selected_event._check_time = new Date(vm.selected_event.check_date);
            }
            vm.show_event_detail = true;

            // Load logbook links for this event
            vm.loadLogbookLinks(event.id);
        };

        vm.closeEventDetail = function () {
            vm.selected_event = null;
            vm.show_event_detail = false;
            vm.logbook_checkboxes = [];
            vm.event_logbook_links = [];
            vm.logbook_load_error = false;
        };

        vm.saveEvent = function () {
            if (!vm.selected_event || !vm.selected_event.id) return;

            var payload = {
                maintenance_type: vm.selected_event.maintenance_type,
                hours_remaining: vm.selected_event.hours_remaining,
                description: vm.selected_event.description,
                checked_by: vm.selected_event.checked_by
            };

            if (vm.selected_event._check_date) {
                var checkDateTime = moment(vm.selected_event._check_date).format('YYYY-MM-DD');
                if (vm.selected_event._check_time) {
                    checkDateTime += ' ' + moment(vm.selected_event._check_time).format('HH:mm:ss');
                }
                payload.check_date = checkDateTime;
            }

            if (vm.selected_event._expiry_date) {
                payload.expiry_date = moment(vm.selected_event._expiry_date).format('YYYY-MM-DD');
            }

            PlaneService.UpdateMaintenanceEvent(vm.selected_event.id, payload)
                .then(function (data) {
                    if (data && data.success !== false) {
                        vm.closeEventDetail();
                        vm.loadMaintenanceEvents();
                        // Refresh plane data too
                        PlaneService.GetByIdMaintenance2(vm.this_plane_id, vm.club_id)
                            .then(function (planeData) {
                                vm.club.plane = planeData;
                            });
                    } else {
                        ToastService.error('Update Error', (data && data.message) || 'Error updating maintenance event.');
                    }
                });
        };

        vm.getEventTypeIcon = function (type) {
            if (!type) return 'fa-wrench';
            switch (type.toLowerCase()) {
                case 'annual': return 'fa-calendar-check-o';
                case '50hours': case '25hours': case '100hours': return 'fa-tachometer';
                case 'extension': return 'fa-clock-o';
                case 'interim': return 'fa-tools';
                case '6months': return 'fa-calendar';
                default: return 'fa-wrench';
            }
        };

        vm.getEventTypeLabel = function (type) {
            if (!type) return 'Maintenance';
            switch (type.toLowerCase()) {
                case 'annual': return 'Annual';
                case '50hours': return '50 Hour';
                case '25hours': return '25 Hour';
                case '100hours': return '100 Hour';
                case 'extension': return 'Extension';
                case 'interim': return 'Interim';
                case '6months': return '6 Month';
                default: return type;
            }
        };

        // ── Logbook Link Methods ──

        // Load available logbooks for the CREATE form
        vm.loadCreateLogbooks = function () {
            if (!vm.this_plane_id) return;
            vm.create_logbook_loading = true;
            vm.create_logbook_error = false;
            vm.create_logbook_checkboxes = [];

            LogbookLinkService.GetAvailableLogbooks(vm.this_plane_id)
                .then(function (data) {
                    vm.create_logbook_loading = false;
                    var available = (data && data.available_logbooks) ? data.available_logbooks : [];
                    // Pre-check airframe by default (backend auto-links airframe anyway)
                    vm.create_logbook_checkboxes = available.map(function (lb) {
                        return {
                            logbook_type: lb.logbook_type,
                            logbook_entity_id: lb.logbook_entity_id,
                            label: lb.label,
                            position: lb.position || null,
                            isLinked: lb.logbook_type === 'airframe'
                        };
                    });
                }, function () {
                    vm.create_logbook_loading = false;
                    vm.create_logbook_error = true;
                });
        };

        // Save logbook links after a new maintenance check is created
        vm.saveCreateLogbookLinks = function (maintenance_check_id) {
            if (!maintenance_check_id) return;

            var selectedLogbooks = vm.create_logbook_checkboxes
                .filter(function (lb) { return lb.isLinked; })
                .map(function (lb) {
                    return {
                        logbook_type: lb.logbook_type,
                        logbook_entity_id: lb.logbook_entity_id
                    };
                });

            // Backend already auto-links airframe, so if only airframe is checked nothing extra to do
            if (selectedLogbooks.length <= 1) return;

            LogbookLinkService.BulkLink(maintenance_check_id, selectedLogbooks);
        };

        vm.toggleCreateLogbook = function (lb) {
            var checked = vm.create_logbook_checkboxes.filter(function (l) { return l.isLinked; }).length;
            if (!lb.isLinked && checked < 1) {
                lb.isLinked = true;
                ToastService.warning('Logbook Required', 'At least one logbook must be selected.');
            }
        };

        vm.loadAvailableLogbooks = function () {
            if (!vm.this_plane_id) return;
            LogbookLinkService.GetAvailableLogbooks(vm.this_plane_id)
                .then(function (data) {
                    if (data && data.available_logbooks) {
                        vm.available_logbooks = data.available_logbooks;
                    }
                });
        };

        vm.loadLogbookLinks = function (maintenance_check_id) {
            if (!maintenance_check_id) return;
            vm.logbook_checkboxes = [];
            vm.logbook_load_error = false;

            // Load both available logbooks and current links, then build checkbox state
            LogbookLinkService.GetAvailableLogbooks(vm.this_plane_id)
                .then(function (availData) {
                    var available = (availData && availData.available_logbooks) ? availData.available_logbooks : [];
                    vm.available_logbooks = available;

                    if (available.length === 0) {
                        vm.logbook_load_error = true;
                        return;
                    }

                    LogbookLinkService.GetLinks(maintenance_check_id)
                        .then(function (linkData) {
                            var links = [];
                            if (linkData && linkData.maintenance_check && linkData.maintenance_check.logbook_links) {
                                links = linkData.maintenance_check.logbook_links;
                            }
                            vm.event_logbook_links = links;

                            // Build checkbox array — include position for sorting
                            vm.logbook_checkboxes = available.map(function (lb) {
                                var isLinked = links.some(function (link) {
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
                        }, function () {
                            vm.logbook_load_error = true;
                        });
                }, function () {
                    vm.logbook_load_error = true;
                });
        };

        vm.saveLogbookLinks = function () {
            if (!vm.selected_event || !vm.selected_event.id) return;

            var selectedLogbooks = vm.logbook_checkboxes
                .filter(function (lb) { return lb.isLinked; })
                .map(function (lb) {
                    return {
                        logbook_type: lb.logbook_type,
                        logbook_entity_id: lb.logbook_entity_id
                    };
                });

            if (selectedLogbooks.length === 0) {
                ToastService.warning('Logbook Required', 'At least one logbook must be selected.');
                return;
            }

            vm.saving_logbook_links = true;
            LogbookLinkService.BulkLink(vm.selected_event.id, selectedLogbooks)
                .then(function (data) {
                    vm.saving_logbook_links = false;
                    if (data && data.success !== false) {
                        // Refresh the links
                        vm.loadLogbookLinks(vm.selected_event.id);
                    } else {
                        ToastService.error('Logbook Links', 'Error saving logbook links: ' + ((data && data.message) || 'Unknown error'));
                    }
                });
        };

        vm.getLogbookIcon = function (type) {
            switch (type) {
                case 'airframe': return 'fa-plane';
                case 'engine': return 'fa-cog';
                case 'propeller': return 'fa-refresh';
                default: return 'fa-book';
            }
        };

        // Count how many logbooks are currently checked
        vm.countCheckedLogbooks = function () {
            if (!vm.logbook_checkboxes || !vm.logbook_checkboxes.length) return 0;
            return vm.logbook_checkboxes.filter(function (lb) { return lb.isLinked; }).length;
        };

        // Prevent unchecking the very last logbook (at least one must remain)
        vm.toggleLogbook = function (lb) {
            if (!lb.isLinked && vm.countCheckedLogbooks() < 1) {
                // Re-check it — can't uncheck the last one
                lb.isLinked = true;
                ToastService.warning('Logbook Required', 'At least one logbook must remain linked.');
            }
        };

        // ═══════════════════════════════════════════════
        // END MAINTENANCE EVENT METHODS
        // ═══════════════════════════════════════════════


        initController();

        function initController() {
           //console.log("check if access is okay");
        }


          var warning_msg = "By deleting this plane, you will also cancel all reservations that this plane currently has."

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
                    ToastService.error('Download Error', 'There was an error downloading the selected document(s).');
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
                    ToastService.error('Download Error', 'There was an error downloading the selected document(s).');
                })
        };

        // function processArrayBufferToBlob(data, headers) {
        //     var octetStreamMime = 'application/octet-stream';
        //     var success = false;

        //     // Get the headers
        //     headers = headers();
        //     //var ttt = title.toLowerCase().replace(/\W/g, '_');
        //     // Get the filename from the x-filename header or default to "download.bin"
        //     var filename = headers['x-filename'] || 'download.zip';

        //     // Determine the content type from the header or default to "application/octet-stream"
        //     var contentType = headers['content-type'] || octetStreamMime;

        //     try {
        //         // Try using msSaveBlob if supported
        //         var blob = new Blob([data], {
        //             type: contentType
        //         });
        //         if (navigator.msSaveBlob)
        //             navigator.msSaveBlob(blob, filename);
        //         else {
        //             // Try using other saveBlob implementations, if available
        //             var saveBlob = navigator.webkitSaveBlob || navigator.mozSaveBlob || navigator.saveBlob;
        //             if (saveBlob === undefined) throw "Not supported";
        //             saveBlob(blob, filename);
        //         }
        //         success = true;
        //     } catch (ex) {
        //         $log.info("saveBlob method failed with the following exception:");
        //         $log.info(ex);
        //     }

        //     if (!success) {
        //         // Get the blob url creator
        //         var urlCreator = window.URL || window.webkitURL || window.mozURL || window.msURL;
        //         if (urlCreator) {
        //             // Try to use a download link
        //             var link = document.createElement('a');
        //             if ('download' in link) {
        //                 // Try to simulate a click
        //                 try {
        //                     // Prepare a blob URL
        //                     var blob = new Blob([data], {
        //                         type: contentType
        //                     });
        //                     var url = urlCreator.createObjectURL(blob);
        //                     link.setAttribute('href', url);

        //                     // Set the download attribute (Supported in Chrome 14+ / Firefox 20+)
        //                     link.setAttribute("download", filename);

        //                     // Simulate clicking the download link
        //                     var event = document.createEvent('MouseEvents');
        //                     event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
        //                     link.dispatchEvent(event);
        //                     success = true;

        //                 } catch (ex) {
        //                     $log.info("Download link method with simulated click failed with the following exception:");
        //                     $log.info(ex);
        //                 }
        //             }

        //             if (!success) {
        //                 // Fallback to window.location method
        //                 try {
        //                     // Prepare a blob URL
        //                     // Use application/octet-stream when using window.location to force download
        //                     var blob = new Blob([data], {
        //                         type: octetStreamMime
        //                     });
        //                     var url = urlCreator.createObjectURL(blob);
        //                     window.location = url;
        //                     success = true;
        //                 } catch (ex) {
        //                     $log.info("Download link method with window.location failed with the following exception:");
        //                     $log.info(ex);
        //                 }
        //             }
        //         }
        //     }

        //     if (!success) {
        //         // Fallback to window.open method
        //         $log.info("No methods worked for saving the arraybuffer, using last resort window.open");
        //         window.open(httpPath, '_blank', '');
        //     }
        //     return filename;
        // };

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

                $log.info("first try");
                // Try using msSaveBlob if supported
                var blob = new Blob([data], {
                    //type: contentType
                    type: 'application/pdf'
                });

                var fileURL = URL.createObjectURL(blob);
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
                            $log.info("second try");
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

                            $log.info("third try");

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