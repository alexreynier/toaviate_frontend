app.directive('fullCalendar', function() {
    return {
        restrict: 'E',
        scope: {
            options: '=' // Pass configuration options from the controller
        },
        link: function(scope, element) {
            var calendarEl = element[0];
            var calendar;

            function renderCalendar() {
                if (calendar) {
                    calendar.destroy(); // Destroy existing instance before re-rendering
                }
                calendar = new FullCalendar.Calendar(calendarEl, scope.options);
                calendar.render();
            }

            // Watch for changes in options and re-render the calendar
            scope.$watch('options', function(newOptions, oldOptions) {
                if (newOptions) {
                    renderCalendar();
                }
            }, true);
        }
    };
});

app.directive('uniquelink', ["$q", "$timeout", "GalleryService", function($q, $timeout, GalleryService) {
  return {
    require: 'ngModel',
    link: function(scope, elm, attrs, ctrl) {

      ctrl.$asyncValidators.uniquelink = function(modelValue, viewValue) {

        if (ctrl.$isEmpty(modelValue)) {
          // consider empty model valid
          return $q.when();
        }

        var def = $q.defer();

      
        GalleryService.CheckLink(modelValue)
          .then(function(data){
            // console.log("RETURNED IS : ");
            // console.log(data);
            if(data.available == true){
              def.resolve();
            } else {
              def.reject();
            }
          })


        return def.promise;
      };
    }
  };
}]);

app.directive('newuniquelink', ["$q", "$timeout", "GalleryService", "LocalDataService", function($q, $timeout, GalleryService, LocalDataService) {
  return {
    require: 'ngModel',
    link: function(scope, elm, attrs, ctrl) {

      ctrl.$asyncValidators.newuniquelink = function(modelValue, viewValue) {

        if (ctrl.$isEmpty(modelValue)) {
          // consider empty model valid
          return $q.when();
        }

        var def = $q.defer();

        var galleries = LocalDataService.data.all_galleries;
        var counter = 0;
        for(var i=0; i < galleries.length; i++){
          if(galleries[i].gallery_link == modelValue){
            counter++;
          }
        }

        if(counter > 1){
          def.reject();
        } else {
          def.resolve();
        }
        
        // GalleryService.CheckLink(modelValue)
        //   .then(function(data){
        //     // console.log("RETURNED IS : ");
        //     // console.log(data);
        //     if(data.available == true){
        //       def.resolve();
        //     } else {
        //       def.reject();
        //     }
        //   })


        return def.promise;
      };
    }
  };
}]);