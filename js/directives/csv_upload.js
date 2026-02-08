// // app.directive('fadeIn', function($timeout){
// //     return {
// //         restrict: 'A',
// //         link: function($scope, $element, attrs){
// //             $element.removeClass("ng-hide-add");
// //             $element.addClass("ng-hide-remove");
// //             // $element.on('load', function() {
// //             //       $element.addClass("ng-hide-add");
// //             // });
// //             setTimeout(function(){
// //               console.log("TIMEOUT DONE");
// //                 $element.addClass("ng-hide-add");
// //             }, 800);

// //         }
// //     }
// // });

// //fade-in

//  app.directive(
//             "fadeIn",
//             function() {
//                 // I alter the DOM to add the fader image.
//                 function compile( element, attributes, transclude ) {
//                     element.prepend( "<img class='fader' />" );
//                     return( link );
//                 }
//                 // I bind the UI events to the $scope.
//                 function link( $scope, element, attributes ) {
//                     var fader = element.find( "img.fader" );
//                     var primary = element.find( "img.image" );
//                     // Watch for changes in the source of the primary
//                     // image. Whenever it changes, we want to show it
//                     // fade into the new source.
//                     $scope.$watch(
//                         "vm.current.image.link",
//                         function( newValue, oldValue ) {
//                             // If the $watch() is initializing, ignore.
//                             if ( newValue === oldValue ) {
//                                 return;
//                             }
//                             // If the fader is still fading out, don't
//                             // bother changing the source of the fader;
//                             // just let the previous image continue to
//                             // fade out.
//                             if ( isFading() ) {
//                                 return;
//                             }
//                             initFade( oldValue );
//                         }
//                     );
//                     // I prepare the fader to show the previous image
//                     // while fading out of view.
//                     function initFade( fadeSource ) {
//                         fader
//                             .prop( "src", fadeSource )
//                             .addClass( "show" )
//                             .css("margin-left", $(".imagemain1").css("margin-left"))
//                         ;
//                         // Don't actually start the fade until the
//                         // primary image has loaded the new source.
//                         primary.one( "load", startFade );
//                     }
//                     // I determine if the fader is currently fading
//                     // out of view (that is currently animated).
//                     function isFading() {
//                         return(
//                             fader.hasClass( "show" ) ||
//                             fader.hasClass( "fadeOut" )
//                         );
//                     }
//                     // I start the fade-out process.
//                     function startFade() {
//                         // The .width() call is here to ensure that
//                         // the browser repaints before applying the
//                         // fade-out class (so as to make sure the
//                         // opacity doesn't kick in immediately).
//                         fader.width();
//                         fader.addClass( "fadeOut" );
//                         setTimeout( teardownFade, 250 );
//                     }
//                     // I clean up the fader after the fade-out has
//                     // completed its animation.
//                     function teardownFade() {
//                         fader.removeClass( "show fadeOut" );
//                     }
//                 }
//                 // Return the directive configuration.
//                 return({
//                     compile: compile,
//                     restrict: "A"
//                 });
//             }
//         );

app.directive("fileread", [function () {
    return {
        scope: {
            fileread: "="
        },
        link: function (scope, element, attributes) {
            element.bind("change", function (changeEvent) {
                var reader = new FileReader();
                reader.onload = function (loadEvent) {
                    scope.$apply(function () {
                        //content = reader.readAsText(file);
                        scope.fileread = loadEvent.target.result.replace(/\r\n|\r/g,'\n');
                    });
                }
                reader.readAsText(changeEvent.target.files[0]);
            });
        }
    }
}]);




