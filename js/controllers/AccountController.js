 app.controller('AccountController', AccountController);

    AccountController.$inject = ['UserService', '$rootScope', '$location'];
    function AccountController(UserService, $rootScope, $location) {
        var vm = this;
        //not much happening here...
        vm.user = $rootScope.globals.currentUser;

        // UserService.GetById($rootScope.globals.currentUser.id)
        //         .then(function (data) {
        //             vm.user = data.user;
        //         });

    }