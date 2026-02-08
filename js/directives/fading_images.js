app.filter('range', function() {
  return function(input, min, max) {
    min = parseInt(min); //Make string input int
    max = parseInt(max);
    for (var i=min; i<=max; i++)
      input.push(i);
    return input;
  };
});


app.directive(
            "numberSelector",
            function() {
                // I alter the DOM to add the fader image.
                function compile( element, attributes, transclude ) {
                    if(attributes.available){

                        var number = attributes.available;
                        var model = attributes.model+"["+attributes.iteration+"].number";
                        console.log("TBD MODEL", model);
                        var tbd = "";
                        for(var i=1;i<=attributes.available;i++){
                            tbd += "<option value='"+i+"'>"+i+"</option>";
                        }

                        element.html( "<select class='form-control' ng-model='"+model+"'>"+tbd+"</select>" );
                        return( link );
                    }
                    
                }
                // I bind the UI events to the $scope.
                function link( $scope, element, attributes ) {
                    console.log("ATTR", attributes.available);
                   
                    function getOptions(){
                        var number = attributes.available;
                        var tbd = "";
                        for(var i=0;i<attributes.available;i++){
                            tbd += "<option value='"+i+"'>"+i+"</option>";
                        }

                        console.log("TBD", tbd);
                    }

                    getOptions();


                    // Watch for changes in the source of the primary
                    // image. Whenever it changes, we want to show it
                    // fade into the new source.
                    // $scope.$watch(
                    //     "vm.current.image.link",
                    //     function( newValue, oldValue ) {
                    //         // If the $watch() is initializing, ignore.
                    //         if ( newValue === oldValue ) {
                    //             return;
                    //         }
                    //         // If the fader is still fading out, don't
                    //         // bother changing the source of the fader;
                    //         // just let the previous image continue to
                    //         // fade out.
                    //         if ( isFading() ) {
                    //             return;
                    //         }
                    //         initFade( oldValue );
                    //     }
                    // );
                    // I prepare the fader to show the previous image
                    // while fading out of view.
                    // function initFade( fadeSource ) {
                    //     fader
                    //         .prop( "src", fadeSource )
                    //         .addClass( "show" )
                    //         .css("margin-left", $(".imagemain1").css("margin-left"))
                    //     ;
                    //     // Don't actually start the fade until the
                    //     // primary image has loaded the new source.
                    //     primary.one( "load", startFade );
                    // }
                    // // I determine if the fader is currently fading
                    // // out of view (that is currently animated).
                    // function isFading() {
                    //     return(
                    //         fader.hasClass( "show" ) ||
                    //         fader.hasClass( "fadeOut" )
                    //     );
                    // }
                    // // I start the fade-out process.
                    // function startFade() {
                    //     // The .width() call is here to ensure that
                    //     // the browser repaints before applying the
                    //     // fade-out class (so as to make sure the
                    //     // opacity doesn't kick in immediately).
                    //     fader.width();
                    //     fader.addClass( "fadeOut" );
                    //     setTimeout( teardownFade, 250 );
                    // }
                    // // I clean up the fader after the fade-out has
                    // // completed its animation.
                    // function teardownFade() {
                    //     fader.removeClass( "show fadeOut" );
                    // }
                }
                // Return the directive configuration.
                return({
                    compile: compile,
                    restrict: "AE"
                });
            }
        );



// app.directive('fadeIn', function($timeout){
//     return {
//         restrict: 'A',
//         link: function($scope, $element, attrs){
//             $element.removeClass("ng-hide-add");
//             $element.addClass("ng-hide-remove");
//             // $element.on('load', function() {
//             //       $element.addClass("ng-hide-add");
//             // });
//             setTimeout(function(){
//               console.log("TIMEOUT DONE");
//                 $element.addClass("ng-hide-add");
//             }, 800);

//         }
//     }
// });

//fade-in

 app.directive(
            "fadeIn",
            function() {
                // I alter the DOM to add the fader image.
                function compile( element, attributes, transclude ) {
                    element.prepend( "<img class='fader' />" );
                    return( link );
                }
                // I bind the UI events to the $scope.
                function link( $scope, element, attributes ) {
                    var fader = element.find( "img.fader" );
                    var primary = element.find( "img.image" );
                    // Watch for changes in the source of the primary
                    // image. Whenever it changes, we want to show it
                    // fade into the new source.
                    $scope.$watch(
                        "vm.current.image.link",
                        function( newValue, oldValue ) {
                            // If the $watch() is initializing, ignore.
                            if ( newValue === oldValue ) {
                                return;
                            }
                            // If the fader is still fading out, don't
                            // bother changing the source of the fader;
                            // just let the previous image continue to
                            // fade out.
                            if ( isFading() ) {
                                return;
                            }
                            initFade( oldValue );
                        }
                    );
                    // I prepare the fader to show the previous image
                    // while fading out of view.
                    function initFade( fadeSource ) {
                        fader
                            .prop( "src", fadeSource )
                            .addClass( "show" )
                            .css("margin-left", $(".imagemain1").css("margin-left"))
                        ;
                        // Don't actually start the fade until the
                        // primary image has loaded the new source.
                        primary.one( "load", startFade );
                    }
                    // I determine if the fader is currently fading
                    // out of view (that is currently animated).
                    function isFading() {
                        return(
                            fader.hasClass( "show" ) ||
                            fader.hasClass( "fadeOut" )
                        );
                    }
                    // I start the fade-out process.
                    function startFade() {
                        // The .width() call is here to ensure that
                        // the browser repaints before applying the
                        // fade-out class (so as to make sure the
                        // opacity doesn't kick in immediately).
                        fader.width();
                        fader.addClass( "fadeOut" );
                        setTimeout( teardownFade, 250 );
                    }
                    // I clean up the fader after the fade-out has
                    // completed its animation.
                    function teardownFade() {
                        fader.removeClass( "show fadeOut" );
                    }
                }
                // Return the directive configuration.
                return({
                    compile: compile,
                    restrict: "A"
                });
            }
        );
