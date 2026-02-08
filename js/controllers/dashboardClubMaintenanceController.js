 app.controller('DashboardClubMaintenanceController', DashboardClubMaintenanceController);

    DashboardClubMaintenanceController.$inject = ['UserService', 'PlaneService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'LicenceService', 'MedicalService', 'DifferencesService', 'PlaneDocumentService', 'FoxService', '$http'];
    function DashboardClubMaintenanceController(UserService, PlaneService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, LicenceService, MedicalService, DifferencesService, PlaneDocumentService, FoxService, $http) {
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

        vm.action = $state.current.data.action;
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

        vm.obj = {
            issues: [],
            issue_confirmation: false
        };

       vm.reported_defects = [];

       vm.maintenance_types = [
        "annual", "25hours", "50hours", "100hours", "interim", "6months", "extension"
       ];

      
        
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
                PlaneService.GetAllByClubMaintenance(vm.club_id)
                    .then(function(data){
                        vm.club.planes = data;   
                        // //console.log(vm.club.planes);
                    });
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
                            alert("Should be sorted!");
                        }  
                        // //console.log(vm.club.planes);
                    });
                } else {
                    //ignore for now
                }
            } else {
                alert("NO IDEA");
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
                vm.show_offline = false;
            } else if(type == "cert"){
                vm.show_cert = true;
                vm.show_insurance = false;
                vm.show_radio = false;
                vm.show_maintenance = false;
                vm.show_noise = false;
                vm.show_offline = false;
            } else if(type == "insurance"){
                vm.show_cert = false;
                vm.show_insurance = true;
                vm.show_radio = false;
                vm.show_maintenance = false;
                vm.show_noise = false;
                vm.show_offline = false;
            } else if(type == "radio"){
                vm.show_cert = false;
                vm.show_insurance = false;
                vm.show_radio = true;
                vm.show_maintenance = false;
                vm.show_noise = false;
                vm.show_offline = false;
            } else if(type == "noise"){
                vm.show_cert = false;
                vm.show_insurance = false;
                vm.show_radio = false;
                vm.show_maintenance = false;
                vm.show_noise = true;
                vm.show_offline = false;
            } else if(type == "offline"){
                vm.show_cert = false;
                vm.show_insurance = false;
                vm.show_offline = true;
                vm.show_radio = false;
                vm.show_noise = false;
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
                alert("The radio is not complete - please ensure to add both expiry date and the new certificate.");
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
                alert("The certificate is not complete - please ensure to add both expiry date and the new certificate.");
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
                alert("The insurance is not complete - please ensure to add both expiry date and the new certificate.");
                return false;
            } else if(vm.files.insurance[0] && vm.obj.insurance_expiry) {
                send_obj.insurance = {
                    file: (vm.files.insurance[0]) ? vm.files.insurance[0].file : {},
                    expiry: vm.obj.insurance_expiry
                }
                send_update = true;
            }



            if((vm.files.noise_cert[0] && !vm.obj.noise_date) || (vm.files.noise_cert[0] == null && vm.obj.noise_date)){
                alert("The noise certificate is not complete - please ensure to add both date and the certificate - or keep them both empty.");
                return false;
            } else if(vm.files.noise_cert[0] && vm.obj.noise_date) {
                send_obj.noise_cert = {
                    file: (vm.files.noise_cert[0]) ? vm.files.noise_cert[0].file : {},
                    noise_level: vm.obj.noise_level,
                    date_issued: vm.obj.noise_date
                }
                send_update = true;
            }



            // //console.log("type:", vm.obj.maintenance_type);
            // //console.log("remaining:", vm.obj.hours_remaining);
            // //console.log("next_check:", vm.obj.next_check);
           


            // //console.log("firs: ", (vm.obj.maintenance_type !== undefined 
            //  || vm.obj.hours_remaining !== undefined 
            //  || vm.obj.next_check !== undefined));

            // //console.log("secon: ",((vm.obj.maintenance_type !== "" || vm.obj.maintenance_type !== undefined) && (vm.obj.hours_remaining !== undefined || vm.obj.hours_remaining !== "") 
            //     && (vm.obj.next_check !== undefined && vm.obj.next_check !== "")) );
          
            if(((vm.obj.maintenance_type !== undefined && vm.obj.maintenance_type !=="extension") 
             || vm.obj.hours_remaining !== undefined 
             || vm.obj.next_check !== undefined)){
                    if((vm.obj.maintenance_type !== "" || vm.obj.maintenance_type !== undefined) && (vm.obj.hours_remaining !== undefined || vm.obj.hours_remaining !== "") 
                && (vm.obj.next_check !== undefined && vm.obj.next_check !== "")){

                    var check_date =  moment( moment(vm.obj.check_date).format("YYYY-MM-DD")+ " "+moment(vm.obj.check_time).format("HH:mm:ss") ).format("YYYY-MM-DD HH:mm:ss");
                // //console.log("NEW DATETIME", check_date);
                // return false;

                    send_obj.maintenance = {
                        maintenance_type: vm.obj.maintenance_type,
                        hours_remaining: vm.obj.hours_remaining,
                        check_date: check_date,
                        expiry_date: vm.obj.next_check,
                        description: vm.obj.description
                    } 

                    send_update = true;
                } else {
                    // //console.log("type:", vm.obj.maintenance_type);
                    // //console.log("remaining:", vm.obj.hours_remaining);
                    // //console.log("next_check:", vm.obj.next_check);
                    alert("The maintenance is not complete - please ensure to add both check date, next check, and hours remaining");
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
                        description: vm.obj.description
                    } 
                    send_update = true;
                } else {
                    // //console.log("type:", vm.obj.maintenance_type);
                    // //console.log("remaining:", vm.obj.hours_remaining);
                    // //console.log("next_check:", vm.obj.next_check);
                    alert("The maintenance is not complete - please ensure to add both check date, next check, and hours remaining");
                    return false; 
                }
              }




              if((vm.obj.offline_until !== "" || vm.obj.offline_notes !== "")){
                    send_obj.offline = {
                        offline_until: vm.obj.offline_until,
                        offline_notes: vm.obj.offline_notes,
                        club_id: vm.club_id
                    } 
                    send_update = true;
                } else {
                    alert("Please ensure that offline date is set in the future!");
                    return false; 
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
                alert("You haven't filled anything - this box will now close without saving any changes.");

            } else {
                // //console.log("TOSAVE: ", send_obj);
                
                vm.send_obj = send_obj;
                PlaneService.AddMaintenance(vm.this_plane_id, send_obj)
                .then(function(data){
                    // //console.log(data);
                    $state.go('dashboard.manage_club.maintenance', {action: "list", reload: true});

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
            alert("Are you sure you would like to delete this plane?");
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
                        alert("Please select a licence and rating that is required to book the plane solo!");
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
                        alert("Please select a medical that is required to book the plane solo!");
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
                        alert("Please select a difference that is required to book the plane solo!");
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