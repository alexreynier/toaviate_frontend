app.controller('UsersController', UsersController);
 
    UsersController.$inject = ['UserService', '$location', '$rootScope', 'FlashService', '$routeParams'];
    function UsersController(UserService, $location, $rootScope, FlashService, $routeParams) {
        var vm = this;
        var this_user;
        vm.update = update;
 		vm.dataLoading = false;

 		vm.default_pwd = "password";

        UserService.GetById($routeParams.userId)
                .then(function (data) {
                    vm.user = data.user;
                });

        function update(id){
            //vm.dataLoading = true;
            if(vm.user.password == "password"){
                vm.user.password = "";
            }
            //console.log(vm.user)
            UserService.Update(vm.user)
                .then(function (response) {
                    if (response.success) {
                        FlashService.Success('Update successful', true);
                        $location.path('/');
                    } else {
                        console.log("response");
                        console.log(response);
                        if(response.message == "Password entered failed") {
                            alert("The password entered was incorrect");
                            vm.dataLoading = false;
                        } else {
                            FlashService.Error(response.error);
                            vm.dataLoading = false;
                        }
                        
                    }
                });
        }
    }