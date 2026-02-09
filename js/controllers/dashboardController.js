 app
.filter("asDate", function () {
    return function (input) {
        if(input && input !== ""){
            return moment(input).toDate();//new Date(input);
        } else {
            return "";
        }
    }
});

 app.controller('DashboardController', DashboardController);

    DashboardController.$inject = ['UserService','$cookieStore', 'BookingService', 'BookoutService', '$rootScope', '$location', 'AuthenticationService'];
    function DashboardController(UserService, $cookieStore, BookingService, BookoutService, $rootScope, $location, AuthenticationService) {
        var vm = this;

        if(!$rootScope.globals.currentUser){
            if(AuthenticationService.CheckLoggedIn() == false){
                //console.log("STOPPING HERE");
                $location.path('/login');
                return false;
            }
            // .then(function(data){
            //     //console.log("DATA : ", data);
            // });
        }

        vm.user = $rootScope.globals.currentUser;
        ////console.log("ROOTSCOPE", $rootScope.globals);

         //CheckLoggedIn

        vm.bookings = [];
        vm.bookouts = [];
        vm.to_pay = [];
        vm.to_complete_split = [];
        
        // //console.log("vmuser", vm.user);
        vm.allUsers = [];

        vm.clubs = [];

        vm.force_show_admins = false;

        if(vm.user && vm.user.access && vm.user.access.manager){
           vm.force_show_admins = true;
        } else if(vm.user && vm.user.access && vm.user.access.instructor){
           vm.force_show_admins = true;
        }
        

        UserService.GetAdminClubs(vm.user.id)
        .then(function(data){
            if(data.success){
                 vm.clubs = data.clubs;   

                // Try to restore previously selected club from localStorage
                var savedClubId = null;
                try {
                    var stored = localStorage.getItem('toaviate_selected_club_id');
                    if (stored !== null) {
                        savedClubId = stored; // keep as string for comparison
                    }
                } catch(e) {}

                var selectedClub = null;
                if (savedClubId !== null) {
                    for (var i = 0; i < vm.clubs.length; i++) {
                        // Compare as strings to avoid type mismatch (API may return int or string)
                        if (String(vm.clubs[i].id) === String(savedClubId)) {
                            selectedClub = vm.clubs[i];
                            break;
                        }
                    }
                }

                // Fall back to first club if no saved selection (or saved club no longer valid)
                if (!selectedClub) {
                    selectedClub = vm.clubs[0];
                }

                vm.club = selectedClub;
                $rootScope.globals.currentUser.current_club_admin = selectedClub;
                $cookieStore.put('globals', $rootScope.globals);

                // Persist the selection
                try {
                    localStorage.setItem('toaviate_selected_club_id', String(selectedClub.id));
                } catch(e) {}

            } else {
                //console.log("ERROR FAIL / LOGOUT", data);
                $location.path('/login');
            }
           
                        
        });


        vm.onClubSelected = function(club) {
            vm.club = club;
            $rootScope.globals.currentUser.current_club_admin = club;
            $cookieStore.put('globals', $rootScope.globals);

            // Persist to localStorage so it survives page reloads
            try {
                localStorage.setItem('toaviate_selected_club_id', String(club.id));
            } catch(e) {}

            console.log('Switched to club:', club.title);
        };


        initController();

        function initController() {
           //console.log("check if access is okay");
           load_bookings();
        }

        function load_bookings(){

            BookingService.GetTodayBookingsUser(vm.user.id)
                        .then(function(data){

                            vm.bookings = data.bookings;   
                            vm.to_pay = data.to_pay; 
                            vm.to_complete_split = data.to_complete_split;  
                            //console.log("to_pay", data.to_pay);
                        });

            


            BookoutService.GetBookoutsToComplete(vm.user.id)
                        .then(function(data){

                            vm.bookouts = data.bookouts;   
                            
                        });
        }

        vm.logout = function(){
            //alert("LOG ME OUT");
            AuthenticationService.Logout(function(data){

                           AuthenticationService.ClearCredentials();
                             
                            $cookieStore.remove('globals');
                            $cookieStore.remove('session');

                            // Clear return URL — this is an intentional logout, not a session timeout
                            try { localStorage.removeItem('toaviate_return_url'); } catch(e) {}

                            $location.path('/login');


                         
                        
                    });
        }


        vm.cancel_bookout = function(id){
            // //console.log("CANCEL BOOKOUT ID: ", id);
            var a = confirm("Are you sure you wish to cancel the bookout?");
            if(a){
                BookoutService.CancelBookout(id)
                 .then(function(data){

                     if(data.success){

                       load_bookings();


                     } else {
                         alert(data.message);
                     }
                                                
                    });


                // //console.log("CANCEL");

            } else {
                return false;
            }
        }

        vm.cancel_booking = function(id){
            // //console.log("CANCEL BOOKOUT ID: ", id);
            var a = confirm("Are you sure you wish to cancel the booking?");
            if(a){
                BookoutService.DeleteBooking(vm.user.id, id)
                 .then(function(data){

                     if(data.success){

                       load_bookings();


                     } else {
                         alert(data.message);
                     }
                                                
                    });


                // //console.log("CANCEL");

            } else {
                return false;
            }
        }

    }