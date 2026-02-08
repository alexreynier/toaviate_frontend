 app.controller('ClaimAFlightController', ClaimAFlightController);

    ClaimAFlightController.$inject = ['UserService', 'FoxService', '$rootScope', '$scope', '$stateParams', '$location'];
    function ClaimAFlightController(UserService, FoxService, $rootScope, $scope, $stateParams, $location) {
        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.unclaimed = [];

        vm.looking_for = $stateParams.registration;
        if(vm.looking_for){
            $scope.my_search2 = vm.looking_for;
        }

        // vm.allUsers = [];
        // vm.deleteUser = deleteUser;

        initController();

        function initController() {
            // loadCurrentUser();
            console.log("init claim a flight controller");
            GetFoxEntries();
            // loadAllUsers();
        }

        function GetFoxEntries() {
            //is this a club_id ? OR is this a USER id --> therefore return all clubs with all un-claimed flights?
            FoxService.GetFoxEntries($rootScope.globals.currentUser.id)
                .then(function (data) {
                    console.log("GetFoxEntries was called here");
                    vm.unclaimed = data;
                    console.log("vm.unclaimed", vm.unclaimed);
                });
        }

        // function loadAllUsers() {
        //     UserService.GetAll()
        //         .then(function (data) {
        //             vm.allUsers = data.users;
        //         });
        // }

       
        // function deleteUser(id) {
        //     UserService.Delete(id)
        //     .then(function(data) {
        //         if(data.success){
	       //          $location.path('/');
        //         }
        //     });
        // }

        $scope.search = function(row){
            ////console.log("hi", (angular.lowercase(row.title).indexOf(angular.lowercase($scope.my_search) || '') !== -1));
            return (angular.lowercase(row.title).indexOf(angular.lowercase($scope.my_search) || '') !== -1);
        };

        $scope.search2 = function(row){
            return (angular.lowercase(row.registration).indexOf(angular.lowercase($scope.my_search2) || '') !== -1);
        };

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
        
        vm.clean_times = function(time){
                return time.substring(0,5);
        }

        vm.difference_times = function(to, from){
            var to_datetime = moment(to);
            var from_datetime = moment(from);
            // console.log("to datetime", to_datetime);
            // console.log("from datetime", from_datetime);
            var duration = moment.duration(from_datetime.diff(to_datetime));
            var hours = duration.asHours();
            //now to hours and seconds??
            var hour = Math.floor(Math.abs(hours));
            var min = Math.round((Math.abs(hours) * 60) % 60);
            return (hour < 10 ? "0" : "") + hour + ":" + (min < 10 ? "0" : "") + min;
            //return hours;
        }

        vm.difference_times_decimal = function(to, from){
            var to_datetime = moment(to);
            var from_datetime = moment(from);
            var duration = moment.duration(from_datetime.diff(to_datetime));
            var hours = duration.asHours();
            return hours;
        }

        vm.airborne_decimal = function(seconds){
             var hours = seconds / 60 / 60;
             return hours;
        }

        vm.airborne_to_hours = function(seconds){
             var hours = seconds / 60 / 60;
             var hour = Math.floor(Math.abs(hours));
             var min = Math.round((Math.abs(hours) * 60) % 60);
             if(min == 60){
                 hour = hour +1;
                 min = 0;
             }
             return (hour < 10 ? "0" : "") + hour + ":" + (min < 10 ? "0" : "") + min;
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


    }