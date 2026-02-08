//var m=angular.module("ui.timepicker",[]);m.value("uiTimepickerConfig",{step:15}),m.directive("uiTimepicker",["uiTimepickerConfig","$parse","$window",function(a,b,c){var d=c.moment,e=function(a){return void 0!==d&&d.isMoment(a)&&a.isValid()},f=function(a){return null!==a&&(angular.isDate(a)||e(a))};return{restrict:"A",require:"ngModel",scope:{ngModel:"=",baseDate:"=",uiTimepicker:"="},priority:1,link:function(b,c,g,h){"use strict";var i=angular.copy(a),j=i.asMoment||!1;delete i.asMoment,h.$render=function(){var a=h.$modelValue;if(angular.isDefined(a)){if(null!==a&&""!==a&&!f(a))throw new Error("ng-Model value must be a Date or Moment object - currently it is a "+typeof a+".");e(a)&&(a=a.toDate()),c.is(":focus")||m()||c.timepicker("setTime",a),null===a&&k()}},b.$watch("ngModel",function(){h.$render()},!0),i.appendTo=i.appendTo||c.parent(),c.timepicker(angular.extend(i,b.uiTimepicker?b.uiTimepicker:{}));var k=function(){c.timepicker("setTime",null)},l=function(){return c.val().trim()},m=function(){return l()&&null===h.$modelValue};c.on("$destroy",function(){c.timepicker("remove")});var n=function(){var a=h.$modelValue?h.$modelValue:b.baseDate;return e(a)?a.toDate():a},o=function(a){return j?d(a):a};c.is("input")?(h.$parsers.unshift(function(a){var b=c.timepicker("getTime",n());return b?o(b):b}),h.$validators.time=function(a){return g.required||l()?f(a):!0}):c.on("changeTime",function(){b.$evalAsync(function(){var a=c.timepicker("getTime",n());h.$setViewValue(a)})})}}}]);

app.directive('datepicker', function(){
  return {
    restrict: 'A',
    link: function (scope, element, attr) {

        var obj = scope.$eval(attr.dateoptions);

            //temp::
            obj.format = "d/m/yyyy";
            obj.autoclose = "true";
            obj.todayHighlight = "true";
            obj.defaultDate = new Date().format("d/M/yyyy");
            obj.setDate = new Date().format("d/M/yyyy");

            // console.log("DATE ", obj.setDate);


            element.datepicker(obj);
           
    }
  }
});


app.directive('timePicker', ['$timeout', function ($timeout) {
    return {
        restrict: 'AC',
        scope: {
            ngModel: '='
        },
        link: function(scope, element, attr) {

            var obj = scope.$eval(attr.timeoptions);
            console.log("BOOOOO ", obj);

            element.on('change', function () {
                if (element.hasClass('start')) {
                    $timeout(function () {
                        var $el = element.closest('[date-pair]').find('input.end'),
                            endScope = angular.element($el).isolateScope();

                        endScope.$apply(function () {
                            endScope.ngModel = $el.val();
                        });
                    }, 0);
                }
            });
            // element.timepicker({
            //     timeFormat: 'H:i',
            //     forceRoundTime: true
            // });
            element.timepicker(obj);
        }
    };
}]);



app.directive('datePair', function(){
    return {
        restrict: 'AC',
        scope: {
            dateoptions: "="
        },
        link: function(scope, element, attr){
        
            var obj = scope.$eval(attr.dateoptions);
            console.log("BOOOOO ", obj);

            //element.datepair(obj);
            element.datepair({
                scrollDefault: 'now',
                showDuration: true
            });
            // var hi = new Datepair(element, obj);

        } 
    }
});

