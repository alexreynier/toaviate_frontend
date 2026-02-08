 app.controller('HomeController', HomeController);

    HomeController.$inject = ['UserService', '$rootScope', '$location'];
    function HomeController(UserService, $rootScope, $location) {
        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        
        vm.allUsers = [];
        vm.deleteUser = deleteUser;

        initController();

        function initController() {
            loadCurrentUser();
            loadAllUsers();
        }

        function loadCurrentUser() {
            UserService.GetById($rootScope.globals.currentUser.id)
                .then(function (data) {
                    vm.user = data.user;
                });
        }

        function loadAllUsers() {
            UserService.GetAll()
                .then(function (data) {
                    vm.allUsers = data.users;
                });
        }

       
        function deleteUser(id) {
            UserService.Delete(id)
            .then(function(data) {
                if(data.success){
	                $location.path('/');
                }
            });
        }
    }