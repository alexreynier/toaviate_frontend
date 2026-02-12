 app.controller('DashboardClubInstructorBookings', DashboardClubInstructorBookings);

    DashboardClubInstructorBookings.$inject = ['UserService', 'PlaneService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'LicenceService', 'MedicalService', 'DifferencesService', 'InstructorService', 'ToastService'];
    function DashboardClubInstructorBookings(UserService, PlaneService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, LicenceService, MedicalService, DifferencesService, InstructorService, ToastService) {
        var vm = this;

           //    /* PLEASE DO NOT COPY AND PASTE THIS CODE. */(function(){var w=window,C='___grecaptcha_cfg',cfg=w[C]=w[C]||{},N='grecaptcha';var gr=w[N]=w[N]||{};gr.ready=gr.ready||function(f){(cfg['fns']=cfg['fns']||[]).push(f);};(cfg['render']=cfg['render']||[]).push('explicit');(cfg['onload']=cfg['onload']||[]).push('initRecaptcha');w['__google_recaptcha_client']=true;var d=document,po=d.createElement('script');po.type='text/javascript';po.async=true;po.src='https://www.gstatic.com/recaptcha/releases/JPZ52lNx97aD96bjM7KaA0bo/recaptcha__en.js';var e=d.querySelector('script[nonce]'),n=e&&(e['nonce']||e.getAttribute('nonce'));if(n){po.setAttribute('nonce',n);}var s=d.getElementsByTagName('script')[0];s.parentNode.insertBefore(po, s);})();

           // var initRecaptcha = function () { 
           //     // document.getElementById("SearchModule").scope().vm.parent.isGrecaptchaLoaded = !0, 
           //     // document.getElementById("SearchModule").scope().vm.showRecaptcha();
           //     vm.showRecaptcha();
           // };
              




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
        vm.surcharge_type = ["none", "flight", "hour"];

        vm.action = $state.current.data.action;
        vm.user = $rootScope.globals.currentUser;

        //console.log("$rootScope.globals.currentUser : ", $rootScope.globals.currentUser);
        
        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user_id = vm.user.id;




         vm.editing = false;
        
        switch(vm.action){
           


            // break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                //console.log("hey");
                InstructorService.GetAllByClub(vm.club_id, vm.user_id)
                    .then(function(data){
                        vm.club.instructors = data.instructors;   
                        //console.log(data);
                        vm.edit_instructor();
                    });
            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  

        //'9' needs to refer the the user's account set to manage
       
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

        vm.save_instructor = function(instructor){

            console.log(instructor.new_colour);

            if(instructor.new_colour && instructor.new_colour !== ""){
                instructor.instructor_colour = hexToRGBA(instructor.new_colour, 1);
                delete(instructor.new_colour);
            }
            console.log(instructor.new_booking_colour);

            if(instructor.new_booking_colour && instructor.new_booking_colour !== ""){
                instructor.booking_colour = hexToRGBA(instructor.new_booking_colour, 1);
                delete(instructor.new_booking_colour);
            }

            console.log("SAVE THIS : ", instructor);

            instructor.edit = false;

            delete(instructor.edit);

            InstructorService.UpdateInstructor(instructor, vm.club_id)
                .then(function(data){
                    //console.log(data);

                    // vm.items = data.items;
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });


        }

        vm.edit_instructor = function(){
            
            for(var i=0; i < vm.club.instructors.length;i++){
                if(vm.club.instructors[i].instructor_colour && vm.club.instructors[i].instructor_colour !== ""){
                    vm.club.instructors[i].new_colour = rgbaToHex(vm.club.instructors[i].instructor_colour);
                }

                if(vm.club.instructors[i].booking_colour && vm.club.instructors[i].booking_colour !== ""){
                    vm.club.instructors[i].new_booking_colour = rgbaToHex(vm.club.instructors[i].booking_colour);
                }
            }
        }

        $scope.save_instructor_order = function(){
            // //console.log("hiya");
            var update_order = [];
            for(var i=0; i < vm.club.instructors.length;i++){
                var me = {
                    id: vm.club.instructors[i].id,
                    display_order: i
                }
                update_order.push(me);
            }
            // //console.log("organised: ", update_order);



            InstructorService.UpdateOrder({"order": update_order}, vm.club_id)
                .then(function(data){
                    console.log(data);

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
            vm.plane_maintenance.cofa_category =  (vm.plane_search.cofa_category.indexOf("cofa") > -1)? "Certificate of Airworthiness" : "Permit to Fly";//(vm.plane_search.cofa_category.indexOf("EASA") > -1)? "EASA Certificate of Airworthiness" : ((vm.plane_search.cofa_category.indexOf("Certificate of Airworthiness") > -1)? "National Certificate of Airworthiness" : "Permit to Fly");
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


        $scope.save = function(){
            if(vm.action == "add"){
                //console.log("CREATE click");
                $scope.create();
            } else {
                //console.log("EDIT click");
                //console.log(vm.club.plane);
                $scope.update();
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
            return false;
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
            ToastService.warning('Confirm Delete', 'Are you sure you would like to delete this plane?');
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
                        ToastService.warning('Missing Licence', 'Please select a licence and rating that is required to book the plane solo!');
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
                        ToastService.warning('Missing Medical', 'Please select a medical that is required to book the plane solo!');
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
                        ToastService.warning('Missing Difference', 'Please select a difference that is required to book the plane solo!');
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