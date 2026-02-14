 app.controller('DashboardClubPlanesController', DashboardClubPlanesController);

    DashboardClubPlanesController.$inject = ['UserService', 'PlaneService', 'FoxService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'LicenceService', 'MedicalService', 'DifferencesService', 'PlaneDocumentService', 'ToastService', 'AircraftChecksService', '$filter'];
    function DashboardClubPlanesController(UserService, PlaneService, FoxService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, LicenceService, MedicalService, DifferencesService, PlaneDocumentService, ToastService, AircraftChecksService, $filter) {
        var vm = this;

           //    /* PLEASE DO NOT COPY AND PASTE THIS CODE. */(function(){var w=window,C='___grecaptcha_cfg',cfg=w[C]=w[C]||{},N='grecaptcha';var gr=w[N]=w[N]||{};gr.ready=gr.ready||function(f){(cfg['fns']=cfg['fns']||[]).push(f);};(cfg['render']=cfg['render']||[]).push('explicit');(cfg['onload']=cfg['onload']||[]).push('initRecaptcha');w['__google_recaptcha_client']=true;var d=document,po=d.createElement('script');po.type='text/javascript';po.async=true;po.src='https://www.gstatic.com/recaptcha/releases/JPZ52lNx97aD96bjM7KaA0bo/recaptcha__en.js';var e=d.querySelector('script[nonce]'),n=e&&(e['nonce']||e.getAttribute('nonce'));if(n){po.setAttribute('nonce',n);}var s=d.getElementsByTagName('script')[0];s.parentNode.insertBefore(po, s);})();

           // var initRecaptcha = function () { 
           //     // document.getElementById("SearchModule").scope().vm.parent.isGrecaptchaLoaded = !0, 
           //     // document.getElementById("SearchModule").scope().vm.showRecaptcha();
           //     vm.showRecaptcha();
           // };
              


        vm.show_loading = false;

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
        vm.gear_types = ["tricycle", "tailwheel", "monowheel", "floats", "amphibian", "skis"];
        // vm.certificates = ["Certificate of Airworthiness", "National Certificate of Airworthiness", "Permit to Fly"];
        vm.certificates = [{id: 1, title: "Certificate of Airworthiness", value: "cofa"}, {id: 2, title: "National Certificate of Airworthiness", value: "cofa"}, {id: 2, title: "LAA Permit to Fly", value: "ptf"}];
        vm.classes = ["SEP (land)", "SEP (sea)", "SET (land)", "SET (sea)", "MEP (land)", "MEP (sea)", "ME"];

        vm.charge_type = ["airborne", "brakes", "tacho", "hobbs", "flight", "brakes_rounded"];
        vm.surcharge_type = ["none", "flight", "hour", "taxi"];

        vm.action = $state.current.data.action;
        vm.user = $rootScope.globals.currentUser;
        //console.log("$rootScope.globals.currentUser : ", $rootScope.globals.currentUser);
        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user_id = vm.user.id;


        vm.plane_certificate = {};
        vm.plane_noise = {};
        vm.plane_radio = {};
        vm.plane_maintenance = {};
        vm.plane_insurance = {};

        vm.plane_engine_1 = {removed_date: ""};
        vm.plane_engine_1_replace = {removed_date: ""};
        vm.plane_engine_2 = {removed_date: ""};
        vm.plane_engine_2_replace = {removed_date: ""};

        vm.plane_propeller_1 = {removed_date: ""};
        vm.plane_propeller_1_replace = {removed_date: ""};
        vm.plane_propeller_2 = {removed_date: ""};
        vm.plane_propeller_2_replace = {removed_date: ""};

        vm.show_replace_engine_1 = false;
        vm.show_replace_engine_2 = false;
        vm.show_replace_prop_1 = false;
        vm.show_replace_prop_2 = false;

        // //console.log(vm.action);
        // //console.log($stateParams);
        // //console.log($stateParams.id);




         LicenceService.GetAll()
            .then(function(data){
                //console.log("LICENCES : ", data.licences);
                vm.licences = data.licences;   
            });

        LicenceService.GetRatings()
            .then(function(data){
                //console.log("RATINGS : ", data);
                vm.ratings = data;   
            });


        MedicalService.GetAuthority()
         .then(function(data){
                //console.log("AUTHORITY : ", data);
                vm.medical_authorities = data;   
            });

         MedicalService.GetComponents()
         .then(function(data){
                //console.log("COMPONENTS : ", data);
                vm.medical_components = data;
            });

         DifferencesService.GetDifferences()
         .then(function(data){
                //console.log("DIFF : ", data);
                vm.differences = data;
            });


         vm.editing = false;
        
        switch(vm.action){
            case "add":
                //console.log("adding a new plane please");
                vm.page_title = "Add a New Plane";
            break;
            case "edit":
                vm.editing = true;
                //console.log("edit an existing plane");
                PlaneService.GetById($stateParams.plane_id, vm.club_id)
                    .then(function(data){
                        vm.club.plane = data;   
                        // vm.club.plane.requirements = {
                        //         licence: [],
                        //         medical: [],
                        //         differences: [],
                        //         hours: []
                        // };

                        console.log(vm.club.plane);

                        if(vm.club.plane.colour && vm.club.plane.colour.indexOf("rgba") > -1){
                            vm.club.plane.colour = rgbaToHex(vm.club.plane.colour);
                        }

                        if(vm.club.plane.bg_colour && vm.club.plane.bg_colour.indexOf("rgba") > -1){
                            vm.club.plane.bg_colour = rgbaToHex(vm.club.plane.bg_colour);
                        }

                        vm.club.plane.airframe_hours = parseFloat(vm.club.plane.airframe_hours);

                        vm.club.plane.vp = (vm.club.plane.vp == 1)? true:false;
                        vm.club.plane.rg = (vm.club.plane.rg == 1)? true:false; 
                        vm.club.plane.tb = (vm.club.plane.tb == 1)? true:false;
                        vm.club.plane.requires_check_a = (vm.club.plane.requires_check_a == 1)? true:false; 

                        vm.plane_engine_1 = vm.club.plane.engine_1;
                        vm.plane_engine_2 = vm.club.plane.engine_2;

                        vm.plane_propeller_1 = vm.club.plane.propeller_1;
                        vm.plane_propeller_2 = vm.club.plane.propeller_2;

                        //console.log(vm.club);
                        vm.page_title = "Edit a Plane - "+vm.club.plane.registration;

                        // Load aircraft checks if this plane requires Check A
                        if (vm.club.plane.requires_check_a) {
                            vm.loadAircraftChecks();
                        }
                    });

               


               


            break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                PlaneService.GetAllByClub(vm.club_id)
                    .then(function(data){
                        vm.club.planes = data;   
                        //console.log(vm.club.planes);
                    });

                    //console.log("hello alex");


            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  

        //'9' needs to refer the the user's account set to manage

        // ── Aircraft Checks History ──
        vm.aircraft_checks = [];
        vm.aircraft_checks_loading = false;
        vm.checks_filter_date = null;
        vm.audit_log = [];
        vm.show_audit_trail = false;

        vm.loadAircraftChecks = function() {
            if (!vm.club.plane || !vm.club.plane.id) return;
            vm.aircraft_checks_loading = true;
            AircraftChecksService.GetChecksByPlane(vm.club.plane.id)
                .then(function(data) {
                    vm.aircraft_checks_loading = false;
                    if (data.success) {
                        vm.aircraft_checks = data.checks;
                    }
                });
        };

        vm.filterChecksByDate = function() {
            if (!vm.checks_filter_date || !vm.club.plane || !vm.club.plane.id) {
                vm.loadAircraftChecks();
                return;
            }
            vm.aircraft_checks_loading = true;
            var dateStr = $filter('date')(vm.checks_filter_date, 'yyyy-MM-dd');
            AircraftChecksService.GetChecksByPlaneDate(vm.club.plane.id, dateStr)
                .then(function(data) {
                    vm.aircraft_checks_loading = false;
                    if (data.success) {
                        vm.aircraft_checks = data.checks;
                    }
                });
        };

        vm.viewCheckAudit = function(check) {
            vm.show_audit_trail = true;
            vm.audit_log = [];
            AircraftChecksService.GetAuditLog(check.id)
                .then(function(data) {
                    if (data.success) {
                        vm.audit_log = data.audit_log;
                    }
                });
        };
       
        $scope.back = function(){
            $window.history.back();
        }



        function rgbaToHex (rgba) {
          var inParts = rgba.substring(rgba.indexOf("(")).split(","),
              r = parseInt(trim(inParts[0].substring(1)), 10),
              g = parseInt(trim(inParts[1]), 10),
              b = parseInt(trim(inParts[2]), 10);
             // a = parseFloat(trim(inParts[3].substring(0, inParts[3].length - 1))).toFixed(2);
          var outParts = [
            r.toString(16),
            g.toString(16),
            b.toString(16)
            //,Math.round(a * 255).toString(16).substring(0, 2)
          ];

          // Pad single-digit output values
          outParts.forEach(function (part, i) {
            if (part.length === 1) {
              outParts[i] = '0' + part;
            }
          })

          return ('#' + outParts.join(''));
        }

        function trim (str) {
          return str.replace(/^\s+|\s+$/gm,'');
        }
        function hexToRGBA(hex, opacity=1) {  
            let r = parseInt(hex.substring(1,3), 16);  
            let g = parseInt(hex.substring(3,5), 16);  
            let b = parseInt(hex.substring(5), 16);  
            var rtn = "rgba("+r+", "+g+", "+b+", "+opacity+")";
            return rtn;
        }

        $scope.save_planes_order = function(){
            // //console.log("hiya");
            var update_order = [];
            for(var i=0; i < vm.club.planes.length;i++){
                var me = {
                    id: vm.club.planes[i].plane_id,
                    display_order: i
                }
                update_order.push(me);
            }
            // //console.log("organised: ", update_order);



            PlaneService.UpdateOrder({"order": update_order})
                .then(function(data){
                    //console.log(data);

                    // vm.items = data.items;
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });

        }


        $scope.set_aircraft_details = function(){

            // console.log("get deeeets", vm.plane_search);

            PlaneService.GetAddAircraft(vm.plane_search.registration)
                .then(function (data) {
                    ////console.log(data);

                    // console.log(data);
                                // return false;

                    if(data){
                        //use GB airfields first...
                       
                         if(data.length == 0){
                            //console.log("SETTINGS HERE");
                                // vm.plane_search = 
                                //     {
                                //         id: 0,
                                //         registation: vm.plane_search.registration,
                                //         icao_type: "not known"
                                //     };

                                // vm.club.plane.manufacturer = vm.plane_search.manufacturer;      

                        } else {

                                vm.plane_search = data;
                                // console.log("SUCCESS FOUND", data);
                                processNewAircraft();
                        }


                        //console.log("PLANE SEARCHED", vm.plane_search);

                    } else {


                        console.log("WOOOPSIES... this aircraft isn't in our database?");
                        //this should be very very rare...

                         // vm.plane_search = 
                         //            {
                         //                registation: vm.plane_search.registration,
                         //                icao_type: "not known"
                         //            };
                                    // vm.club.plane.manufacturer = vm.plane_search.manufacturer;                        

                    }

                });


        }

        function processNewAircraft(){


            //vm.club.plane 

            //TYPES -->>>

              //aircraft_class --> FIXED-WING LANDPLANE
                  //is_propeller = 1
                  //number_of_engines  --> 1 = SEP
                                    // --> >1 = MEP

                  //is_propeller = 0
                  //number_of_engines  --> 1 = SET
                                    // --> >1 = ME


            vm.club.plane.manufacturer = vm.plane_search.manufacturer;                        
            vm.club.plane.serial_no = vm.plane_search.serial_number;                        
            vm.club.plane.plane_type = vm.plane_search.icao_type;                        
            vm.club.plane.type_name = vm.plane_search.type_name;                        
            vm.club.plane.year_built = vm.plane_search.year_built;                        
            vm.club.plane.aircraft_id = vm.plane_search.id;       
            vm.club.plane.mtow = parseInt(vm.plane_search.mtow);
            vm.club.plane.airframe_hours = vm.plane_search.airframe_hours;          


            // alert(vm.plane_search.gear_type);

            if(vm.plane_search.noise_level){

                var regex = /[+-]?\d+(\.\d+)?/g;

                vm.plane_noise.noise_level = vm.plane_search.noise_level.match(regex).map(function(v) { return parseFloat(v); });
                ////console.log(floats);

            }
            // vm.club.plane.noise_level = vm.plane_search.noise_level;//parseInt(vm.plane_search.noise_level);                 
            


            vm.plane_noise.noise_cert_issue = (vm.plane_search.noise_cert_issue)? new Date(vm.plane_search.noise_cert_issue) : "";                 

            if(vm.plane_search.aircraft_class.indexOf("FIXED-WING") > -1){

                if(vm.plane_search.is_propeller > 0 && vm.plane_search.engine_name.indexOf("PT6A-") == -1){

                    vm.club.plane.plane_class = (vm.club.plane.number_of_engines > 1) ? "MEP" : "SEP";

                } else {

                    vm.club.plane.plane_class = (vm.club.plane.number_of_engines > 1) ? "ME" : "SET";

                }

                if(vm.plane_search.aircraft_class.indexOf("LANDPLANE") > -1){
                    vm.club.plane.plane_class = vm.club.plane.plane_class + " (land)";
                    vm.club.plane.gear_type = "";
                }

                if(vm.plane_search.aircraft_class.indexOf("AMPHIBIAN") > -1 || vm.plane_search.aircraft_class.indexOf("FLOAT") > -1){
                    vm.club.plane.plane_class = vm.club.plane.plane_class + " (sea)";
                    vm.club.plane.gear_type = (vm.plane_search.aircraft_class.indexOf("AMPHIBIAN") > -1)? "amphibian" : "floats";
                }



            }        



            vm.club.plane.seats = (parseInt(vm.plane_search.seats) + 1);


            //Certificate of Airworthiness ==> National CofA
            //Permit to Fly ==> LAA permit
            //EASA Certificate of Airworthiness ==> EASA CofA

            if(vm.plane_maintenance && vm.plane_maintenance.cofa_category){
                vm.plane_maintenance.cofa_category =  (vm.plane_search.cofa_category.indexOf("cofa") > -1)? "Certificate of Airworthiness" : "Permit to Fly";//(vm.plane_search.cofa_category.indexOf("EASA") > -1)? "EASA Certificate of Airworthiness" : ((vm.plane_search.cofa_category.indexOf("Certificate of Airworthiness") > -1)? "National Certificate of Airworthiness" : "Permit to Fly");
            }

            vm.plane_maintenance.certificate_expiry = new Date(vm.plane_search.cofa_expiry);
            
            vm.club.plane.cofa_category = vm.plane_maintenance.cofa_category;//(vm.plane_search.cofa_category.indexOf("EASA") > -1)? "easa_cofa" : ((vm.plane_search.cofa_category.indexOf("Certificate of Airworthiness") > -1)? "n_cofa" : "permit")

            vm.club.plane.gear_type = vm.plane_search.gear_type;



            //ENGINES AND PROPS!!!
            vm.plane_engine_1.make = vm.plane_search.engine_name;                        
            vm.plane_engine_1.model = vm.plane_search.engine_name;                     

            vm.plane_propeller_1.make = vm.plane_search.propeller_manufacturer;                        
            vm.plane_propeller_1.model = vm.plane_search.propeller_name;                        

            if(vm.plane_search.number_of_engines > 1){
                
                vm.number_of_engine = vm.plane_search.number_of_engines;

                vm.plane_engine_2.make = vm.plane_search.engine_name;                        
                vm.plane_engine_2.model = vm.plane_search.engine_name;
                
                vm.plane_propeller_2.make = vm.plane_search.propeller_manufacturer;                        
                vm.plane_propeller_2.model = vm.plane_search.propeller_name; 
            }   

        }


        vm.clearFieldError = function(event) { ToastService.clearFieldError(event); };

        $scope.save = function(){
            var checks = [];
            if (vm.action == 'add') {
                // Aircraft Details
                checks.push({ ok: vm.plane_search && vm.plane_search.registration, field: 'registration', label: 'Registration' });
                checks.push({ ok: vm.club.plane.manufacturer,    field: 'manufacturer',    label: 'Manufacturer' });
                checks.push({ ok: vm.club.plane.serial_no,       field: 'serial_no',       label: 'Serial Number' });
                checks.push({ ok: vm.club.plane.year_built,      field: 'year_built',      label: 'Year Built' });
                checks.push({ ok: vm.club.plane.plane_class,     field: 'plane_class',     label: 'Aircraft Class' });
                checks.push({ ok: vm.club.plane.gear_type,       field: 'gear_type',       label: 'Undercarriage Type' });
                checks.push({ ok: vm.club.plane.seats,           field: 'seats',            label: 'Total Seats' });
                checks.push({ ok: vm.club.plane.mtow,            field: 'mtow',             label: 'MTOW' });
                checks.push({ ok: vm.club.plane.airframe_hours != null && vm.club.plane.airframe_hours !== '', field: 'airframe_hours', label: 'Airframe Hours' });

                // Engine 1
                checks.push({ ok: vm.plane_engine_1.make,         field: 'engine1_make',         label: 'Engine Make' });
                checks.push({ ok: vm.plane_engine_1.model,        field: 'engine1_model',        label: 'Engine Model' });
                checks.push({ ok: vm.plane_engine_1.serial_no,    field: 'engine1_serial_no',    label: 'Engine Serial Number' });
                checks.push({ ok: vm.plane_engine_1.total_hours_at_start != null && vm.plane_engine_1.total_hours_at_start !== '', field: 'engine1_total_hours', label: 'Engine Total Hours' });
                checks.push({ ok: vm.plane_engine_1.date_fitted,  field: 'engine1_date_fitted',  label: 'Engine Date Fitted' });
                checks.push({ ok: vm.plane_engine_1.tbo_hours != null && vm.plane_engine_1.tbo_hours !== '', field: 'engine1_tbo_hours', label: 'Engine TBO Hours' });

                // Propeller 1
                checks.push({ ok: vm.plane_propeller_1.make,         field: 'prop1_make',         label: 'Propeller Make' });
                checks.push({ ok: vm.plane_propeller_1.model,        field: 'prop1_model',        label: 'Propeller Model' });
                checks.push({ ok: vm.plane_propeller_1.serial_no,    field: 'prop1_serial_no',    label: 'Propeller Serial Number' });
                checks.push({ ok: vm.plane_propeller_1.date_fitted,  field: 'prop1_date_fitted',  label: 'Propeller Date Fitted' });
                checks.push({ ok: vm.plane_propeller_1.tbo_hours != null && vm.plane_propeller_1.tbo_hours !== '', field: 'prop1_tbo_hours', label: 'Propeller TBO Hours' });
                checks.push({ ok: vm.plane_propeller_1.total_hours_at_start != null && vm.plane_propeller_1.total_hours_at_start !== '', field: 'prop1_hours', label: 'Propeller Hours' });

                // Maintenance
                checks.push({ ok: vm.plane_maintenance.cofa_category,       field: 'cert_type',          label: 'Certificate Type' });
                checks.push({ ok: vm.plane_maintenance.certificate_expiry,  field: 'cert_expiry',        label: 'Certificate Expiry' });
                checks.push({ ok: vm.plane_maintenance.next_maintenance,    field: 'next_maintenance',   label: 'Next Maintenance' });
                checks.push({ ok: vm.plane_maintenance.hours_remaining != null && vm.plane_maintenance.hours_remaining !== '', field: 'hours_remaining', label: 'Hours Remaining' });

                // Default Charges
                checks.push({ ok: vm.club.plane.charge_type,     field: 'charge_type',     label: 'Charge Type' });
                checks.push({ ok: vm.club.plane.tacho_hour_fee != null && vm.club.plane.tacho_hour_fee !== '', field: 'tacho_hour_fee', label: 'Cost Per Hour' });
            }
            checks.push({ ok: vm.club.plane.plane_type, field: 'plane_type', label: 'ICAO Type' });
            if (!ToastService.validateForm(checks)) return;

            if(vm.action == "add"){
                $scope.create();
            } else {
                $scope.update();
            }
        }
        vm.disable_reset = false;
        vm.disable_reset2 = false;


        //https://local.toaviate.com/api/v1/fox/fix_uncombined

        vm.fix_uncombined = function(){

            var a = confirm("Are you sure you wish to fix uncombined flight logs - this will also reset the aerolpane logbooks and cannot be undone.");
            if(a && !vm.disable_reset2){
                vm.disable_reset2 = true;
                vm.show_loading = true;
                //FoxService
                FoxService.FixUncombinedLogs(vm.club_id)
                .then(function(data){
                    ////console.log(data);
                    $state.go('dashboard.manage_club.planes', {reload: true});
                    vm.disable_reset2 = true;
                    vm.show_loading = false;
                });

            } else {
                console.log("cancelled");
                vm.show_loading = false;
            }
        }

        vm.reset_all_club_logs = function(){
            var a = confirm("Are you sure you wish to reset this?");
            if(a && !vm.disable_reset){
                vm.disable_reset = true;
                vm.show_loading = true;
                //FoxService
                FoxService.ResetAllClubPlanes(vm.club_id)
                .then(function(data){
                    ////console.log(data);
                    $state.go('dashboard.manage_club.planes', {reload: true});
                    vm.disable_reset = true;
                    vm.show_loading = false;
                });

            } else {
                console.log("cancelled");
                vm.show_loading = false;
            }
        }

        vm.round_brake_times_start = function(input, earlier_input=null){
            
                if(input){
                  if(input.indexOf(":") > -1){
                    var split = input.split(":");
                    var x = split[1];



                    var min_nearest_five = ((x % 5) >= 2.5 ? parseInt(x / 5) * 5 + 5 : parseInt(x / 5) * 5);
                    


                    if(min_nearest_five < 10){
                      min_nearest_five = "0"+min_nearest_five;
                    } else if(min_nearest_five == 60){
                      split[0]++;
                      min_nearest_five = "00";
                    } else if(min_nearest_five > 60){
                      split[0]++;
                      min_nearest_five = (min_nearest_five - 60);
                    }


                    if(earlier_input && earlier_input.indexOf(":") > -1){
                            // console.log("total calculated?");
                            // console.log("earlier_input: ", earlier_input);
                            // console.log("input: ", input);
                            var esplit = earlier_input.split(":");
                            var ehour = esplit[0];
                            var emin = esplit[1];
                            var etot = (parseInt(ehour)*60) + parseInt(emin); 
                            // console.log("etot: ", etot);
                            var hr = split[0];
                            var mn = min_nearest_five;
                            var tot = (parseInt(hr)*60) + parseInt(mn);
                            // console.log("tot: ", tot);

                            if(etot < tot){
                                //the earlier time is after the end time
                                // console.log("etot < tot");
                                min_nearest_five = parseInt(min_nearest_five) - 5;
                                if(min_nearest_five == 60){
                                    split[0]++; 
                                    min_nearest_five = "00";
                                } else if(min_nearest_five > 60){
                                    split[0]++;
                                    min_nearest_five = (min_nearest_five - 60);
                                    if(min_nearest_five < 10 ){
                                      min_nearest_five = "0"+min_nearest_five;
                                    }
                                } else if(min_nearest_five < 0){
                                    split[0]--;
                                    min_nearest_five = (60 + parseInt(min_nearest_five));
                                }
                                // console.log("split: ", split[0]);
                                // console.log("min_nearest_five: ", min_nearest_five);
                            }

                    }
                    //essentially we add 5 in case something happens over the limit

                    return split[0] + ":" + min_nearest_five;
                  } else {
                    return input;
                  }
                } else {
                  return '';
                }
          

          }


        $scope.create = function(){
            ////console.log("CREATE ME NOW");
            vm.club.plane.club_id = vm.club_id;
            vm.club.plane.add_documents = vm.plane_documents;
            vm.club.plane.registration = vm.plane_search.registration;

            vm.club.maintenance_type = vm.plane_maintenance.cofa_category.value;

            console.log("vm.plane_maintenance.cofa_category ", vm.club.maintenance_type );
            //return false;
            
            vm.plane_maintenance.file = vm.files.cert[0];
            vm.plane_radio.file = vm.files.radio[0];
            vm.plane_noise.file = vm.files.noise[0];
            vm.plane_insurance.file = vm.files.insurance[0];

            vm.club.plane.maintenance = vm.plane_maintenance;
            vm.club.plane.insurance = vm.plane_insurance;
            vm.club.plane.noise_cert = vm.plane_noise;
            vm.club.plane.radio_licence= vm.plane_radio;

            vm.club.plane.vp = (vm.club.plane.vp)? 1:0;
            vm.club.plane.rg = (vm.club.plane.rg)? 1:0; 
            vm.club.plane.tb = (vm.club.plane.tb)? 1:0;
            vm.club.plane.requires_check_a = (vm.club.plane.requires_check_a)? 1:0;

            vm.club.plane.engine_1 = vm.plane_engine_1;
            vm.club.plane.engine_2 = vm.plane_engine_2;
            vm.club.plane.propeller_1 = vm.plane_propeller_1;
            vm.club.plane.propeller_2 = vm.plane_propeller_2;


            if(vm.club.plane.colour && vm.club.plane.colour !== "" && vm.club.plane.colour.indexOf("rgba") == -1){
                vm.club.plane.colour = hexToRGBA(vm.club.plane.colour, 0.75);
            } 

            if(vm.club.plane.bg_colour && vm.club.plane.bg_colour !== "" && vm.club.plane.bg_colour.indexOf("rgba") == -1){
                vm.club.plane.bg_colour = hexToRGBA(vm.club.plane.bg_colour, 0.25);
            } 


            //return false;
            //console.log("PLANE TO ADD, ", vm.club.plane);
            //return false;
            PlaneService.Create(vm.club.plane)
                .then(function(data){
                    ////console.log(data);
                    $state.go('dashboard.manage_club.planes', {reload: true});

                });
        }

        $scope.delete = function(){
            //console.log("CLICK");
            ToastService.warning('Delete Plane', 'Are you sure you would like to delete this plane?');
            PlaneService.Update(vm.club.plane)
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
            vm.club.plane.club_id = vm.club_id;
            vm.club.plane.add_documents = vm.plane_documents;

            vm.club.plane.update_documents = get_update_docs();
            //get_update_docs();

            if(vm.club.plane.colour && vm.club.plane.colour !== "" && vm.club.plane.colour.indexOf("rgba") == -1){
                vm.club.plane.colour = hexToRGBA(vm.club.plane.colour, 0.75);
            } 

            if(vm.club.plane.bg_colour && vm.club.plane.bg_colour !== "" && vm.club.plane.bg_colour.indexOf("rgba") == -1){
                vm.club.plane.bg_colour = hexToRGBA(vm.club.plane.bg_colour, 0.25);
            } 

            PlaneService.Update(vm.club.plane)
                .then(function(data){
                    //console.log(data);
                    //console.log("saved");
                    $state.go('dashboard.manage_club.planes');
                });
        }

        vm.save_new_aircraft_bit = function(item, num){
            
            // console.log(item);
            // console.log(num);

            //this assumes there was an engine and prop already saved


            var comb = "plane_"+item+"_"+num;
            var comb2 = "plane_"+item+"_"+num+"_replace";

            var item_update = {};
            
            if(vm[comb] && vm[comb] !== ""){
                //only if there is one set --> FIRST!!!
                vm[comb].removed_date = vm[comb2].removed_date;
                delete(vm[comb2].removed_date);

                item_update = {
                    old_item: vm[comb],
                    new_item: vm[comb2],
                    plane_id: vm.club.plane.id,
                    item: item,
                    no: num
                };
            } else {
                item_update = {
                    old_item: {},
                    new_item: vm[comb2],
                    plane_id: vm.club.plane.id,
                    item: item,
                    no: num
                };
            }

            

            // if(item == "engine"){
            //     if(num == 1){
                    
            //         console.log( "engine", vm );
            //         console.log( "engine", vm.plane_engine_1 );
            //         console.log( "engine", vm.plane_engine_1.removed_date );
            //         console.log( "engine", vm.plane_engine_1_replace );
            //         console.log( "engine", vm.plane_engine_1_replace.removed_date );

            //         vm.plane_engine_1.removed_date = vm.plane_engine_1_replace.removed_date;
            //         delete(vm.plane_engine_1_replace.removed_date);
            //         item_update.old_item = vm.plane_engine_1;
            //         item_update.new_item = vm.plane_engine_1_replace;

            //     } else if(num == 2){
            //         vm.plane_engine_2.removed_date = vm.plane_engine_2_replace.removed_date;
            //         delete(vm.plane_engine_2_replace.removed_date);
            //         item_update.old_item = vm.plane_engine_2;
            //         item_update.new_item = vm.plane_engine_2_replace;
            //     }
            // } else if(item == "propeller"){
            //     if(num == 1){
            //         vm.plane_propeller_1.removed_date = vm.plane_engine_1_replace.removed_date;
            //         delete(vm.plane_engine_1_replace.removed_date);
            //         item_update.old_item = vm.plane_propeller_1;
            //         item_update.new_item = vm.plane_engine_1_replace;
            //     } else if(num == 2){
            //         vm.plane_propeller_2.removed_date = vm.plane_engine_2_replace.removed_date;
            //         delete(vm.plane_engine_2_replace.removed_date);
            //         item_update.old_item = vm.plane_propeller_2;
            //         item_update.new_item = vm.plane_engine_2_replace;
            //     }
            // }

           
            console.log("LETS SEE WHAT WOULD BE SENT", item_update);


            PlaneService.UpdateAircraftBit(item_update)
                .then(function(data){
                    console.log(data);
                    //console.log("saved");
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
            //console.log("ADD");
            switch(type){
                case "licence":
                    //console.log("licence");
                    if(vm.temporary.licence && vm.temporary.licence !== "" && vm.temporary.rating && vm.temporary.rating !== ""){
                        //then we can add it
                        //console.log("here we go");
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
                        ToastService.warning('Selection Required', 'Please select a licence and rating that is required to book the plane solo!');
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
                        ToastService.warning('Selection Required', 'Please select a medical that is required to book the plane solo!');
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
                        ToastService.warning('Selection Required', 'Please select a difference that is required to book the plane solo!');
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


        vm.files = {
            radio: [],
            cert: [],
            insurance: [],
            noise: []
        }


           $scope.processFile = function(files, location){
                 //console.log("files", files[0].file_return);

                     // //console.log("JSON", files[i].file_return);
                    var j = JSON.parse(files[0].file_return);
                     ////console.log("PARSED", j);
                    // //console.log("J is : ",j);
                    // //console.log("name is : ", j.files.file.name);

                    files[0].file.temp_path = j.saved_url;
                    files[0].file.save_name = j.files.file.name;

                    var ft = j.files.file.name;
                    //console.log("ft", ft);
                    var fft = ft.split('.').pop();
                    files[0].file.extension = fft;
                    //console.log("FILE is : ", files[0]);

                    // //console.log("file", files[i].file);
                    vm.files[location].push(files[0].file);


            }

            $scope.set_title = function(file){
                //console.log("return", file);
                return file.save_name;
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
                //console.log("HELLO DELETE");
                //update view?
                 vm.club.planes = $.grep(vm.club.planes, function(e){ 
                    return e.id != id; 
                });
             });

            }, function () {
              $log.info('Modal dismissed at: ' + new Date());
            });


          };
         

         vm.aircraft;
         vm.plane_search;
         vm.plane_to_add;

         $scope.get_aircraft = function(registration){

            if(registration.length > 3){

                 PlaneService.GetAddAircraft(registration)
                .then(function (data) {
                    ////console.log(data);
                    if(data){
                        //use GB airfields first...
                         
                        // vm.aircraft = data;
                        // console.log("one is : ", data[0]);
                       
                         if(data.length == 0){
                            // console.log("SETTINGS HERE");
                              vm.aircraft = [
                                    {
                                        icao_type: "not known",
                                        registration: registration.toUpperCase()
                                    }];
                        } else {
                            vm.aircraft = data;
                        }

                    } else {

                          vm.aircraft = [
                                    {
                                        icao_type: "not known",
                                        registration: registration.toUpperCase()
                                    }];

                                    //console.log(vm.aircraft);
                        // console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });


            }

            
        }


    }