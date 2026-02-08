 app.controller('DashboardClubPackagesController', DashboardClubPackagesController);

    DashboardClubPackagesController.$inject = ['UserService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'PackageService', 'PlaneService'];
    function DashboardClubPackagesController(UserService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, PackageService, PlaneService) {
        var vm = this;

        vm.charge_type = ["brakes", "session", "plane"];


        vm.page_title = "";

        vm.action = $state.current.data.action;
        vm.user = $rootScope.globals.currentUser;
        // //console.log("$rootScope.globals.currentUser : ", $rootScope.globals.currentUser);
        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user_id = vm.user.id;

        vm.packages = [];


        // //console.log(vm.action);
        // //console.log($stateParams);
        // //console.log($stateParams.id);


        vm.editing = false;
        
        switch(vm.action){
            case "add":
                //console.log("adding a new packages");

                  PlaneService.GetAllByClub(vm.club_id)
                    .then(function(data){
                        vm.planes_original = data; 
                        vm.planes = JSON.parse(JSON.stringify(vm.planes_original));


                    });

            break;
            case "edit":
                vm.editing = true;
                //console.log("edit an existing packages");

                vm.package_id = $stateParams.package_id;

                PackageService.GetPackageById($stateParams.package_id)
                    .then(function(data){
                        vm.package = data.item;   
                        vm.package.available = (vm.package.available == 1) ? true : false;
            
                        vm.page_title = "Edit a Package - "+vm.package.title;
                    });
 
                    PackageService.GetPackagePlanesByPackageId($stateParams.package_id)
                    .then(function(data){
                        vm.aircraft = data.items;   
            
                        PlaneService.GetAllByClub(vm.club_id)
                        .then(function(data){
                            vm.planes_original = data; 
                            vm.planes = JSON.parse(JSON.stringify(vm.planes_original));

                            vm.clean_aircraft_selection();

                        });


                    });




            break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                PackageService.GetPackagesByClubId(vm.club_id)
                    .then(function(data){
                        vm.packages = data.items;   
                        //console.log(vm.packages);
                    });
            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  

       
        
        function refresh_aircraft(){

                  PackageService.GetPackagePlanesByPackageId($stateParams.package_id)
                    .then(function(data){
                        vm.aircraft = data.items;   
                    });

        }

        //'9' needs to refer the the user's account set to manage
       
        $scope.back = function(){
            $window.history.back();
        }



        $scope.save = function(){
            if(vm.action == "add"){
                //console.log("CREATE click");
                $scope.create();
            } else {
                //console.log("EDIT click");
                //console.log(vm.package);
                $scope.update();
            }
        }

        
      



       


        vm.delete_aircraft = function(aircraft, index){


            if(vm.action == "add"){

                vm.aircraft.splice(index, 1);
                            vm.clean_aircraft_selection();

            } else {
                // //console.log("EXAM", exam);
                if(confirm("Are you sure you wish to delete this aircraft for this package? This is irreversible.")){

                    PackageService.DeletePackagePlane(aircraft.id)
                        .then(function(data){
                            //console.log(data);
                            if(data.success){
                                vm.aircraft.splice(index, 1);
                                vm.clean_aircraft_selection();
                            } else {
                                alert("An error occurred...");
                            }
                            //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                        });
                }
            }
            
        }

       vm.aircraft = [];
       vm.new_aircraft2 = {};
       vm.new_aircraft = {};

        vm.add_aircraft = function(){


            if(vm.action == "add"){
                 
                 vm.aircraft.push(vm.new_aircraft.plane);
                            vm.clean_aircraft_selection();
                 vm.new_aircraft = {};
                            vm.new_aircraft2 = {};

            } else {

                vm.new_aircraft2.package_id = vm.package_id; 
                vm.new_aircraft2.club_id = vm.club_id; 
                vm.new_aircraft2.plane_id = vm.new_aircraft.plane.plane_id;

                PackageService.CreatePackagePlane(vm.new_aircraft2)
                    .then(function(data){
                        //console.log(data);
                        if(data.success){

                            vm.aircraft.push(data.item);

                            vm.clean_aircraft_selection();
                            
                            vm.new_aircraft = {};
                            vm.new_aircraft2 = {};

                        } else {
                            alert("An error occurred...");
                        }

                        //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                    });

            }

            
        }


        vm.clean_aircraft_selection = function(){

            // vm.aircraft ==> list of aircraft already on this package

            // vm.planes ==> list of aircraft that can be added to this package

            //remove vm.planes entries which match the ones in aircraft list

          

            //vm.planes = vm.planes.filter( ( el ) => !vm.aircraft.includes( el.plane_id ) );

            // vm.planes = vm.planes_original;

            vm.planes = JSON.parse(JSON.stringify(vm.planes_original));


           
            for(var j=0;j<vm.aircraft.length;j++) {

              var i = 0;
              while (i < vm.planes.length) {
                if (vm.planes[i].plane_id === vm.aircraft[j].plane_id) {
                  vm.planes.splice(i, 1);
                } else {
                  ++i;
                }
              }


          }





        }










        vm.update_charge = function(charge, index){

            delete(charge.edit_me);

            PackageService.UpdateCharge(charge)
                .then(function(data){
                    //console.log(data);
                    if(data.success){

                        vm.instructor_charges[index].edit_me = false;

                    } else {
                        alert("An error occurred...");
                    }
                    //refresh_tem();
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                });
        }

        vm.update_cancel_charge = function(index){
            refresh_charges();
        }

        vm.edit_charge = function(index){

            vm.instructor_charges[index].edit_me = true;

        }

        vm.delete_charge = function(charge, index){
            // //console.log("EXAM", exam);
            if(confirm("Are you sure you wish to delete this instructor charge? This is irreversible.")){

                PackageService.DeleteCharge(charge.id)
                    .then(function(data){
                        //console.log(data);
                        if(data.success){
                            vm.instructor_charges.splice(index, 1);
                        } else {
                            alert("An error occurred...");
                        }
                        //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                    });
            }
        }

       
        
        vm.add_charge = function(){

            vm.new_charge.course_id = $stateParams.course_id; 
            vm.new_charge.club_id = vm.club_id; 

            PackageService.CreateCharge(vm.new_charge)
                .then(function(data){
                    //console.log(data);
                    if(data.success){

                        vm.instructor_charges.push(data.item);

                        vm.new_charge = {
                            title: "",
                            charge_type: "",
                            price: ""
                        }

                    } else {
                        alert("An error occurred...");
                    }

                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });
        }




        vm.convert_decimal_to_hours = function(decimal_time){
            var temp = new Array();
            temp = decimal_time.toString().split('.');
            
            var hours = temp[0];
            if(hours < 10){
                hours = "0"+hours;
            }
            if(temp[1]){
               var minutes = 100 / temp[1];
                minutes = Math.round(60 / minutes); 

                if(minutes < 10){
                    minutes = "0"+minutes;
                }
            } else {
                minutes = "00"
            }

            return hours + ':' + minutes;
        }








         vm.delete_course = function(id, index){
            if(confirm("Are you sure you wish to delete this course? This is irreversible.")){

                PackageService.DeletePackage(id)
                    .then(function(data){
                        //console.log(data);
                        if(data.success){
                            vm.packages.splice(index, 1);
                        } else {
                            alert("An error occurred...");
                        }
                        //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                    });
            } 
        }

        $scope.create = function(){
            ////console.log("CREATE ME NOW");
         
            //return false;
            //return false;
            vm.package.club_id = vm.club_id;
            vm.package.aircraft = vm.aircraft;

            PackageService.CreatePackage(vm.package)
                .then(function(data){
                    ////console.log(data);
                        
                    $state.go('dashboard.manage_club.package', {reload: true});

                });


        }

        $scope.delete = function(){
            //console.log("CLICK");
            alert("Are you sure you would like to delete this course?");
            PackageService.DeletePackage(vm.package.id)
                .then(function(data){
                    //console.log(data);
                });
        }

        function get_update_docs(){
            var documents = [];

            for(var i=0;i<update_this_file.length;i++){
                var id = update_this_file[i];
                //console.log("looking for : ", id);
                //console.log("in: ", vm.course_documents);

                for(var k=0;k<vm.package.course_documents.length;k++){
                    //console.log("comparing to : ", vm.package.course_documents[k].id);
                    if(vm.package.course_documents[k].id == id){
                        documents.push(vm.package.course_documents[k]);
                    }
                }

            }

            // //console.log("DOCS TO UPDATE : ", documents);

            return documents;
        }

        $scope.update = function(){
            //console.log("CLICK");
         

            PackageService.UpdatePackage(vm.package)
                .then(function(data){
                    //console.log(data);
                    //console.log("saved");
                    $state.go('dashboard.manage_club.package');
                });
        }






        initController();

        function initController() {
           //console.log("check if access is okay");
        }


}