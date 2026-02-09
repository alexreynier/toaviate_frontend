app.filter('capitalise', function() {
    return function(input) {
      return (!!input) ? input.charAt(0).toUpperCase() + input.substr(1).toLowerCase() : '';
    }
});

app.filter('myDateTime', function() {
    return function(input) {
      return (!!input) ? moment(input).format("DD/MM/YYYY HH:mm") : '';
    }
});

app.filter('myToUpperCase', function(){
  return function(input){
    return (!!input) ? input.toUpperCase() : '';
  }
});

app.filter('brakesTime', function() {
    return function(input) {
      if(input){
        var split = input.split(":");
        return (!!input) ? split[0]+":"+split[1] : '';
      } else {
        return '';
      }
    }
});

app.directive('datetimez', function() {
    return {
        restrict: 'A',
        require : 'ngModel',
        link: function(scope, element, attrs, ngModelCtrl) {
          element.datetimepicker({
            dateFormat:'dd/MM/yyyy 00:00:00',
            language: 'EN',
            // pickTime: false,
            pickSeconds: false    
          }).on('changeDate', function(e) {
            ngModelCtrl.$setViewValue(e.date);
            scope.$apply();
            $(this).parent().find("input").focus();
          });
        }
    };
});

app.filter('roundFive', function(){
  return function(input){
            if(input){
              if(input.indexOf(":") > -1){
                var split = input.split(":");
                var x = split[1];
                var min_nearest_five = ((x % 5) >= 2.5 ? parseInt(x / 5) * 5 + 5 : parseInt(x / 5) * 5);
                if(min_nearest_five < 10){
                  min_nearest_five = "0"+min_nearest_five;
                } else if(min_nearest_five == 60){
                  split[0]++;
                  min_nearest_five = "00";
                }
                return split[0] + ":" + min_nearest_five;
              } else {
                return input;
              }
            } else {
              return '';
            }
          }
});


app.filter('myTimeUTC', function() {
    return function(input) {
      return (!!input) ? moment.utc(input).format("HH:mm") : '';
    }
});


// app.directive('collapsible', ['$timeout', function($timeout){
//         return {
//           restrict: 'A',
//           scope: { collapsible: '=' },
//           link: function(scope, el) {
//             var node = el[0];
//             node.style.height = scope.collapsible ? node.scrollHeight + 'px' : '0px';
//             if (scope.collapsible) node.classList.add('open');

//             scope.$watch('collapsible', function(isOpen) {
//               // Ensure layout is ready
//               $timeout(function(){
//                 if (isOpen) {
//                   // measure to target height
//                   node.classList.add('open');
//                   var target = node.scrollHeight;
//                   node.style.height = target + 'px';

//                   // after transition ends, set to auto for flexible content
//                   var onEnd = function(e){
//                     if (e.propertyName === 'height') {
//                       node.style.height = 'auto';
//                       node.removeEventListener('transitionend', onEnd);
//                     }
//                   };
//                   node.addEventListener('transitionend', onEnd);
//                 } else {
//                   // collapse from current height (may be auto): set explicit height first
//                   var current = node.getBoundingClientRect().height;
//                   node.style.height = current + 'px';
//                   // force reflow for transition kick-off
//                   node.offsetHeight; // eslint-disable-line no-unused-expressions
//                   node.classList.remove('open');
//                   node.style.height = '0px';
//                 }
//               });
//             });

//             // If inner content resizes while open, keep height in sync (optional, lightweight)
//             var ro = null;
//             if ('ResizeObserver' in window) {
//               ro = new ResizeObserver(function(){
//                 if (scope.collapsible && node.style.height === 'auto') return;
//                 if (scope.collapsible) node.style.height = node.scrollHeight + 'px';
//               });
//               ro.observe(node);
//               scope.$on('$destroy', function(){ ro && ro.disconnect(); });
//             }
//           }
//         };
//       }]);

// app.directive('collapsible', ['$timeout', function($timeout){
//         return {
//           restrict: 'A',
//           scope: { collapsible: '=' }, // 1.4.x doesn't support '<'
//           link: function(scope, el) {
//             var node = el[0];

//             function open() {
//               node.classList.add('open');
//               // Set to measured height, then to auto after transition
//               node.style.height = node.scrollHeight + 'px';
//               var onEnd = function(e){
//                 if (e.propertyName === 'height') {
//                   node.style.height = 'auto';
//                   node.removeEventListener('transitionend', onEnd);
//                 }
//               };
//               node.addEventListener('transitionend', onEnd);
//             }

//             function close() {
//               // If height is 'auto', set explicit current height first
//               var current = node.getBoundingClientRect().height;
//               node.style.height = current + 'px';
//               // Force reflow
//               /* eslint-disable no-unused-expressions */
//               node.offsetHeight;
//                eslint-enable no-unused-expressions 
//               node.classList.remove('open');
//               node.style.height = '0px';
//             }

//             // Init
//             $timeout(function(){
//               if (scope.collapsible) {
//                 node.classList.add('open');
//                 node.style.height = 'auto';
//               } else {
//                 node.classList.remove('open');
//                 node.style.height = '0px';
//               }
//             });

//             scope.$watch('collapsible', function(isOpen){
//               $timeout(function(){
//                 if (isOpen) { open(); } else { close(); }
//               });
//             });

//             // Optional: keep in sync on content resize
//             var ro = null;
//             if ('ResizeObserver' in window) {
//               ro = new ResizeObserver(function(){
//                 if (scope.collapsible && node.style.height !== 'auto') {
//                   node.style.height = node.scrollHeight + 'px';
//                 }
//               });
//               ro.observe(node);
//               scope.$on('$destroy', function(){ if (ro) ro.disconnect(); });
//             }
//           }
//         };
//       }]);

app.filter('numberFixedLen', function () {
    return function(a,b){
        return(1e4+""+a).slice(-b);
    };
});

app.directive('collapsible', ['$timeout', function($timeout){
      return {
        restrict: 'A',
        scope: { collapsible: '=' },
        link: function(scope, el) {
          var node = el[0];
          function open(){
            node.classList.add('open');
            node.style.height = node.scrollHeight + 'px';
            var onEnd = function(e){
              if(e.propertyName==='height'){
                node.style.height = 'auto';
                node.removeEventListener('transitionend', onEnd);
              }
            };
            node.addEventListener('transitionend', onEnd);
          }
          function close(){
            var current = node.getBoundingClientRect().height;
            node.style.height = current + 'px';
            node.offsetHeight;
            node.classList.remove('open');
            node.style.height = '0px';
          }
          scope.$watch('collapsible', function(isOpen){
            $timeout(function(){ isOpen ? open() : close(); });
          });
        }
      };
    }]);




  // Minimal DOM builders (no inline styles beyond positioning)
  function buildSuccessDOM(msg) {
    var wrapper = document.createElement('div');
    wrapper.className = 'payok-root';
    wrapper.setAttribute('role', 'status');
    wrapper.setAttribute('aria-live', 'polite');

    var confetti = document.createElement('div');
    confetti.className = 'payok-confetti';
    for (var i = 0; i < 24; i++) {
      var piece = document.createElement('div');
      piece.className = 'payok-piece';
      piece.style.left = (Math.random() * 100) + 'vw';
      piece.style.animationDelay = (Math.random() * 150) + 'ms';
      piece.style.animationDuration = (900 + Math.random() * 600) + 'ms';
      confetti.appendChild(piece);
    }

    var toast = document.createElement('div');
    toast.className = 'payok-toast';

    var ico = document.createElement('div');
    ico.className = 'payok-ico';

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'payok-check');
    svg.setAttribute('viewBox', '0 0 24 24');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M5 13l4 4L19 7');
    svg.appendChild(path);
    ico.appendChild(svg);

    var text = document.createElement('div'); text.className = 'payok-text';
    var title = document.createElement('div'); title.className = 'payok-title'; title.textContent = msg || 'Payment successful';
    var sub = document.createElement('div');   sub.className   = 'payok-sub';   sub.textContent   = 'Your payment has been processed.';
    text.appendChild(title); text.appendChild(sub);

    toast.appendChild(ico); toast.appendChild(text);

    wrapper.appendChild(confetti);
    wrapper.appendChild(toast);
    return { root: wrapper, toast: toast };
  }

  function buildFailureDOM(msg) {
    var wrapper = document.createElement('div');
    wrapper.className = 'payfail-root';
    wrapper.setAttribute('role', 'alert');
    wrapper.setAttribute('aria-live', 'assertive');

    var toast = document.createElement('div');
    toast.className = 'payfail-toast';

    var ico = document.createElement('div');
    ico.className = 'payfail-ico';

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'payfail-x');
    svg.setAttribute('viewBox', '0 0 24 24');
    var p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p1.setAttribute('d', 'M6 6L18 18');
    var p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p2.setAttribute('d', 'M18 6L6 18');
    svg.appendChild(p1); svg.appendChild(p2);
    ico.appendChild(svg);

    var text = document.createElement('div'); text.className = 'payfail-text';
    var title = document.createElement('div'); title.className = 'payfail-title'; title.textContent = msg || 'Payment failed';
    var sub = document.createElement('div');   sub.className   = 'payfail-sub';   sub.textContent   = "Your payment method wasn't charged. Please try again.";
    text.appendChild(title); text.appendChild(sub);

    toast.appendChild(ico); toast.appendChild(text);
    wrapper.appendChild(toast);
    return { root: wrapper, toast: toast };
  }


  
   app.directive('paymentSuccessToast', ['$timeout', function ($timeout) {
      return {
        restrict: 'A',
        scope: {
          paymentSuccessToast: '=', // boolean trigger
          message: '@?',            // optional title
          durationMs: '=?',         // optional duration
          onDone: '&?'              // optional callback
        },
        link: function (scope) {
          var showMs = angular.isNumber(scope.durationMs) ? scope.durationMs : 2200;
          var hideTimer, doneTimer, nodes;

          function cleanup() {
            if (hideTimer) $timeout.cancel(hideTimer);
            if (doneTimer) $timeout.cancel(doneTimer);
            hideTimer = doneTimer = null;
            if (nodes && nodes.root && nodes.root.parentNode) {
              nodes.root.parentNode.removeChild(nodes.root);
            }
            nodes = null;
          }

          function show() {
            cleanup();
            nodes = buildSuccessDOM(scope.message);
            document.body.appendChild(nodes.root);
            hideTimer = $timeout(function () {
              if (!nodes) return;
              nodes.toast.classList.add('payok-hide');
              doneTimer = $timeout(function () {
                cleanup();
                if (scope.onDone) scope.onDone();
              }, 380);
            }, showMs);
          }

          scope.$watch('paymentSuccessToast', function (fire) {
            if (fire) $timeout(show);
          });

          scope.$on('$destroy', cleanup);
        }
      };
    }])

    // FAILURE — attribute directive (same format, no confetti)
    app.directive('paymentFailureToast', ['$timeout', function ($timeout) {
      return {
        restrict: 'A',
        scope: {
          paymentFailureToast: '=', // boolean trigger
          message: '@?',
          durationMs: '=?',
          onDone: '&?'
        },
        link: function (scope) {
          var showMs = angular.isNumber(scope.durationMs) ? scope.durationMs : 2600;
          var hideTimer, doneTimer, nodes;

          function cleanup() {
            if (hideTimer) $timeout.cancel(hideTimer);
            if (doneTimer) $timeout.cancel(doneTimer);
            hideTimer = doneTimer = null;
            if (nodes && nodes.root && nodes.root.parentNode) {
              nodes.root.parentNode.removeChild(nodes.root);
            }
            nodes = null;
          }

          function show() {
            cleanup();
            nodes = buildFailureDOM(scope.message);
            document.body.appendChild(nodes.root);
            hideTimer = $timeout(function () {
              if (!nodes) return;
              nodes.toast.classList.add('payfail-hide');
              doneTimer = $timeout(function () {
                cleanup();
                if (scope.onDone) scope.onDone();
              }, 380);
            }, showMs);
          }

          scope.$watch('paymentFailureToast', function (fire) {
            if (fire) $timeout(show);
          });

          scope.$on('$destroy', cleanup);
        }
      };
    }]);
  


  app.directive('paymentAccordion', function(){
    return {
      restrict: 'E',
      scope: {
        methods: '=',
        savedCards: '=',
        send: '=',
        open: '=',
        info: '=',
        user: '=',
        bookout: '=',
        invoice: '=',
        onConfirm: '&'
      },
      controllerAs: 'vm',
      bindToController: true,
      templateUrl: '/js/directives/payment-form.html',   // <-- use external template
      controller: ['$sce', 'PaymentService', '$scope', 'BookoutService', 'EnvConfig', function($sce, PaymentService, $scope, BookoutService, EnvConfig){
        var vm = this;

        vm.show_loading = false;
        vm.show_cardmachine = false;

        /*
          Create New Card Intent:::: 
          1. invoice_id, club_id, user_id
          2. booking_id, club_id, user_id
          3. amount, club_id, user_id(opt)

        */

        //console.log(vm.send);

        PaymentService.CreatePaymentIntentNewCard(vm.send)
            .then(function (data) {
                console.log("DATA HERE", data);
                // Initialize Stripe.js
                var stripe = Stripe(EnvConfig.getStripeKey());

                const options = {
                  clientSecret: data.client_secret,
                  // Fully customizable with appearance API.
                  appearance: {
                    rules: {
                      '.ModalContent': {
                        zIndex: 999999999999999991 // Set this higher than your popup's z-index
                      },
                      '.ModalOverlay': {
                        zIndex: 999999999999999991 // Set this higher than your popup's z-index
                      }
                    }
                  },
                   wallets: {
                    link: 'never' // Never show Link
                  },
                  paymentMethodOrder: ['card', 'apple_pay', 'google_pay']

                };

                // Set up Stripe.js and Elements using the SetupIntent's client secret
                const elements = stripe.elements(options);

                // Create and mount the Payment Element
                const paymentElementOptions = { layout: 'tabs'};
                const paymentElement = elements.create('payment', paymentElementOptions);
                paymentElement.mount('#payment-element');


                const submitButton = document.getElementById('submit-stripe');
                if (submitButton) {
                  submitButton.addEventListener('click', async (event) => {

                    $scope.$apply(() => {
                        vm.show_loading = true;
                    });
                    event.preventDefault();
                    //console.log('Submit button clicked!');
                    
                    // Process the payment manually
                    const {error, paymentIntent} = await stripe.confirmPayment({
                      elements,
                      confirmParams: {
                       // return_url: 'https://example.com/order/confirmation',
                      },
                      redirect: 'if_required', // Only redirect if absolutely necessary
                    });
                    
                    if (error) {
                      if(error.code == "payment_intent_authentication_failure"){
                          //vm.paymentOk = true
                          vm.paymentNo = true;
                          vm.payment_status_message = "You have failed to pass your card issuer's authentication - please try again or pay with another payment method.";
                          //alert("You have failed to pass your card issuer's authentication - please try again or pay with another payment method.");
                          // vm.show_loading = false;
                          //after_success_bookin(where_to, data);
                      } else {
                        //alert(error.message);
                        //vm.paymentOk = true;
                        vm.paymentNo = true;
                        vm.payment_status_message = error.message;
                        // vm.show_loading = false;
                      }

                      $scope.$apply(() => {
                            vm.show_loading = false;
                        });

                    } else if(paymentIntent){
                        //console.log("SUCCESS??");
                            if (paymentIntent.status === 'succeeded') {
                                //console.log("PAYMENT SUCCEEDED!!");
                                //alert("SUCCEEDED");
                                vm.paymentOk = true;
                                //this is where I will now look at confirming that this is paid etc...paymentIntent
                                vm.onConfirm({ methodLabel: 'new-card', paymentIntent: paymentIntent });
                                // $scope.$apply(() => {
                                //     vm.book_in_flight('new_card', paymentIntent);
                                // });
                                

                            } else {
                                //alert("FAILED??");
                                console.log("ERROR", paymentIntent);
                                 //console.log("There was an error processing your payment");
                                 vm.paymentNo = true;
                                vm.payment_status_message = "There was an error processing your payment";

                                $scope.$apply(() => {
                                    vm.show_loading = true;
                                });
                            }
                    }
                  });
                }




            });


        //vm.confirm('Card Machine') --> this is the completion of whatever is going on.

        vm.expandedId = vm.open;
        vm.selectedId = vm.open;
        vm.selectedSavedCardId = null;

        vm.dd   = { name: '', email: '', sortCode: '', account: '' };
        vm.card = { name: '', number: '', exp: '', cvc: '' };

        vm.$onInit = function(){
          if (vm.methods && vm.methods.length) {
            vm.expandedId = vm.methods[0].id;
            vm.selectedId = vm.methods[0].id;
          }
          if (vm.savedCards && vm.savedCards.length) {
            vm.selectedSavedCardId = vm.savedCards[0].id;
          }
        };

        vm.toggle = function(id){
          vm.expandedId = (vm.expandedId === id) ? null : id;
          vm.selectedId = id;
        };
        vm.isExpanded = function(id){ return vm.expandedId === id; };
        vm.keyHeader = function(e, id){
          var k = e.which || e.keyCode;
          if (k === 13 || k === 32) { e.preventDefault(); vm.toggle(id); }
        };
        vm.switchTo = function(type){
          for (var i=0; i<vm.methods.length; i++){
            if (vm.methods[i].type === type) {
              vm.selectedId = vm.methods[i].id;
              vm.expandedId = vm.methods[i].id;
              break;
            }
          }
        };
        vm.ddReady = function(){
          return !!(vm.dd.name && vm.dd.email && vm.dd.sortCode && vm.dd.account);
        };
        vm.cardReady = function(){
          return !!(vm.card.name && vm.card.number && vm.card.exp && vm.card.cvc);
        };
        vm.confirm = function(methodLabel, paymentIntent=null){
          vm.onConfirm({ methodLabel: methodLabel, paymentIntent: paymentIntent });
        };
        vm.selectedTitle = function(){
          for (var i=0; i<vm.methods.length; i++){
            if (vm.methods[i].id === vm.selectedId) { return vm.methods[i].title; }
          }
          return null;
        };

        vm.selectSavedCard = function(id){ vm.selectedSavedCardId = id; };

        vm.keySelectTile = function(e, id){
          var k = e.which || e.keyCode;
          if (k === 13 || k === 32) { e.preventDefault(); vm.selectSavedCard(id); }
        };
        vm.cardBrandIcon = function(brand){
          var visa = '<svg viewBox="0 0 36 24"><rect width="36" height="24" rx="4" fill="#0a4595"/><text x="18" y="16" text-anchor="middle" font-size="10" fill="#fff">VISA</text></svg>';
          var mc   = '<svg viewBox="0 0 36 24"><rect width="36" height="24" rx="4" fill="#1f2937"/><circle cx="15" cy="12" r="6.5" fill="#eb001b"/><circle cx="21" cy="12" r="6.5" fill="#f79e1b" opacity=".9"/></svg>';
          var amex = '<svg viewBox="0 0 36 24"><rect width="36" height="24" rx="4" fill="#2e77bb"/><text x="18" y="16" text-anchor="middle" font-size="9" fill="#fff">AMEX</text></svg>';
          var b = (brand || '').toLowerCase();
          var svg = /visa/.test(b) ? visa
                  : /(master|mc)/.test(b) ? mc
                  : /(amex|american)/.test(b) ? amex
                  : '<svg viewBox="0 0 36 24"><rect width="36" height="24" rx="4" fill="#eef2ff"/><text x="18" y="15" text-anchor="middle" font-size="8" fill="#4f46e5">CARD</text></svg>';
          return $sce.trustAsHtml(svg);
        };

        vm.close_machine_popup = function(){

            //clear the card machine and close the popup??

            //at this point the flight probably has already been booked back in... lets consider how to give options for payment
             BookoutService.ClearMachine(vm.payment_id, vm.club_id)
            .then(function(data){
                if(data.success){
                    console.log("machine should be clear now?", data);
                    vm.show_cardmachine = false;
                    vm.show_after_bookedin = true;

                } else {
                    console.log("No success on card machine clear");
                    //at this point the flight probably has already been booked back in... lets consider how to give options for payment
                    vm.show_cardmachine = false;
                    vm.show_after_bookedin = true;
                }
            });



            // vm.show_cardmachine = false;
            // vm.show_after_bookedin = true;

        }

        vm.cancel_machine = function(){

            //cancel the payment request?
            BookoutService.ClearMachine(vm.payment_id, vm.club_id)
            .then(function(data){
                if(data.success){
                    console.log("machine should be clear now?", data);
                    vm.show_cardmachine = false;
                    //at this point the flight probably has already been booked back in... lets consider how to give options for payment
                    vm.show_after_bookedin = true;
                    vm.stop_polling = true;

                } else {
                    console.log("No success on card machine clear");
                    //at this point the flight probably has already been booked back in... lets consider how to give options for payment
                    vm.show_after_bookedin = true;

                }
            });



        }

        vm.close_bookedin = function(){

            BookoutService.ClearMachine(vm.payment_id, vm.club_id)
            .then(function(data){
                 //once cleared - we continue?
                 console.log("regardless of clear - should now be cleared?");
                 vm.show_cardmachine = false;
                 vm.show_after_bookedin = false;
                 vm.stop_polling = true;
                 //after_success_bookin(vm.after_where_to, vm.after_data);

                 //return complete FALSE

            });

        }


        vm.reset_card_machine = function(){

            //console.log("retry", vm.payment_id);
            //try to send the request a second time to the machine?
            BookoutService.RetryPaymentMachine(vm.payment_id, vm.club_id)
            .then(function(data){
                console.log(data);
                if(data.success){
                    //alert("The card machine should hopefully be displaying the payment now");
                    //create new poll??
                    vm.stop_polling = false;
                    poll_check_payment(vm.payment_id, 30, function(result, details) {
                        if (result) {
                            vm.stop_polling = true;
                            //alert("Payment confirmed!");
                            vm.paymentOk = true;
                            vm.onConfirm({ methodLabel: 'card-machine', paymentIntent: details.paymentIntent });

                        } else {
                            //alert("Payment not confirmed - please try again");
                            vm.paymentNo = true;
                            vm.payment_status_message = "Payment was not confirmed - please try again";
                        }
                    });
                } else {
                    if(data.success == false && data.message == "The payment has already been successfully made."){
                        vm.stop_polling = true;
                        vm.onConfirm({ methodLabel: 'card-machine', paymentIntent: data.paymentIntent });
                    }
                    console.log(data.message);
                }

            });


            vm.show_cardmachine = true;

        }

        vm.payment_errors = [];

        function poll_check_payment(id, maxAttempts, finalCallback) {
            var attempts = 0;

                function attempt() {
                  if(vm.stop_polling){
                    return;
                  }
                    check_payment(id, function(success, details) {
                        attempts++;
                        if (success) {
                            // console.log("Payment confirmed!");
                            finalCallback(true, details);
                        } else if (attempts >= maxAttempts) {
                            // console.log("Max attempts reached, giving up.");
                            finalCallback(false, "");
                        } else if (vm.stop_polling) {
                            // console.log("called to stop polling");
                            finalCallback(false, "");
                            return;
                        } else {
                            // console.log(details);
                            if(details && details.add_info && details.add_info !== ""){
                              var new_error = {payment_id: vm.payment_id, charge_id: details.add_info.charge};
                              // console.log("errors are: ", vm.payment_errors);
                              // console.log("new error is: ", new_error);
                              var check = vm.payment_errors.some(el => (el.charge_id === details.add_info.charge && el.payment_id === vm.payment_id));
                              // console.log("did new error exist?? ", check);
                              if(check){
                                // console.log("there was a previous error - but we keep going");
                                // console.log("Retrying in 10000 ms...");
                                setTimeout(attempt, 10000);
                              } else {
                                vm.payment_errors.push(new_error);
                                //alert("There was an error with the payment: "+details.add_info.code+"\n"+details.add_info.message);
                                // console.log(details.add_info); 
                                vm.paymentNo = true;
                                vm.payment_status_message = "There was an error with the payment: "+details.add_info.code+"\n"+details.add_info.message;
                                vm.stop_polling = true;
                                finalCallback(false, "");
                                return;
                              }

                            } else {
                              console.log("Retrying in 5sec...");
                              setTimeout(attempt, 5000);
                            }
                            
                        }
                    });
                }

                attempt(); // Start polling
        }

        function get_update_on_cardmachine(payment_id, retry, limit, callback2){
            if(retry <= limit){

                check_payment(payment_id, function(result, details) {
                  // console.log("DEETS",details);
                    if (result) {
                        // do something if true
                        // console.log("RESPONSE FROM CHECK PAYMENT IS TRUE");
                        callback2(true);//{success: true, message: "payment checked & done"};
                    } else {
                        // do something if false
                         // console.log("delay and try again?");
                    
                        setTimeout(() => {
                          // console.log("Delayed for 5 second.", payment_id);
                          // console.log("Delayed for 5 second.", vm.payment_id);
                          retry++;
                          callback2(get_update_on_cardmachine(payment_id, retry, limit, callback));
                        }, 10000);
                    }
                });

                
            } else {
                console.log("over limit?");
                callback2(false);// false;//{success: false, message: "too many attempts"};
            }
        }

        function check_payment(id, callback){

            BookoutService.CheckPayment(id)
            .then(function(data){
                if(data.success){
                    // console.log("check payment", data);
                    if(data.status){
                        // console.log("status = true");
                         callback(true, data);
                    } else {
                        // console.log("status = false");
                         callback(false, data);
                    }
                    
                } else {
                        // console.log("NOTHING SENT?");
                         callback(false, data.add_info);
                }
            });

           // return false;

        }

        //create_saved_card_intent
        //create_payment_intent_new_card
        //create_cardmachine_intent

        // service.CreatePaymentIntentNewCard = CreatePaymentIntentNewCard; //ok
        // service.CreateSavedPaymentIntent = CreateSavedPaymentIntent; //ok
        // service.CreateCardMachinePaymentIntent = CreateCardMachinePaymentIntent; //ok

        vm.pay_with_cardmachine = function(){
            vm.show_loading = true;
            //booking_id: vm.bookout.booking_id,
            // var obj = {
            //     user_id: vm.user.id,
            //     club_id: vm.bookout.club_id
            // }

            //console.log("OBJ --> ", vm.send);

            PaymentService.CreateCardMachinePaymentIntent(vm.send)
               .then(function (data) {
                            //console.log(data);
                            if(data.success){
                              vm.stop_polling = false;
                              //success means the paymentIntent was created and the cardmachine was setup
                              //NOT that it has successfully been done... soooo we show the cardmachine overlay
                              vm.show_loading = false;
                              vm.show_cardmachine = true;

                              vm.payment_id = data.paymentID;

                              //and we start polling I think??
                              poll_check_payment(data.paymentID, 30, function(result, details) {
                                  if (result) {
                                      vm.stop_polling = true;
                                      //alert("Payment confirmed!");
                                      vm.paymentOk = true;
                                      vm.show_loading = false;
                                      //after_success_bookin(where_to, data);
                                      vm.onConfirm({ methodLabel: 'card-machine', paymentIntent: details.paymentIntent });

                                  } else {
                                      //alert("Payment not confirmed - please try again");
                                      vm.paymentNo = true;
                                      vm.payment_status_message = "Payment not confirmed - please try again";
                                      vm.show_loading = false;
                                  }
                              });




                            } else {

                              alert("We had an issue talking to the card machine - please try again by using the buttons below");
                              vm.show_loading = false;
                              vm.show_cardmachine = true;

                              //and do nothing else for now!


                            }
                });

        }


        vm.pay_with_saved_card = function(){
            vm.show_loading = true;
            //console.log("cardid = ", vm.selectedSavedCardId);
            
            // .. // .. /// .. /// .. // ... //
            //we need to create a payment intent for the booking rather than a singular invoice
            // PaymentService.CreatePaymentIntentBooking


            //at the moment this only does the bookout - will need to adjust.... for individual invoice payment

            // var obj = {
            //     booking_id: vm.bookout.booking_id,
            //     user_id: vm.user.id,
            //     card_id: vm.selectedSavedCardId,
            //     club_id: vm.bookout.club_id
            // }

            vm.send.card_id = vm.selectedSavedCardId;

            //console.log("OBJ --> ", vm.send);

            //for the cardmachine... this is what we're after
            //PaymentService.CreateCardMachinePaymentIntentBooking(OBJ)
            
            PaymentService.CreateSavedPaymentIntent(vm.send)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                               
                              //this is where we can do the callback??

                              //alert("SUCCESS!");
                              vm.paymentOk = true;

                              vm.onConfirm({ methodLabel: 'saved-card', paymentIntent: data.payment });

                                ////console.log("CARDS", vm.cards);
                            } else {
                               console.log("WOOOPSIES...", data);
                                //this shows the user the 3DS confirmation

                                var stripe = Stripe(EnvConfig.getStripeKey());
                                stripe.confirmCardPayment(
                                  data.client_secret,
                                  {
                                    payment_method: data.payment_method,
                                    return_url: data.card_url.return_url
                                  },
                                  // Disable the default next action handling.
                                  // {handleActions: false}
                                ).then(function(result) {
                                  // Handle result.error or result.paymentIntent
                                  // More details in Step 2.
                                  //console.log(result);
                                 
                                  if(result.error) {
                                    console.log(result.error);
                                    if(result.error.code == "payment_intent_authentication_failure"){
                                        //alert("You have failed to pass your card issuer's authentication - please try again or pay with another payment method.");
                                        vm.paymentNo = true;
                                        vm.payment_status_message = "You have failed to pass your card issuer's authentication - please try again or pay with another payment method.";
                                        vm.show_loading = false;
                                    } else {
                                      // alert(result.error.message);
                                      vm.paymentNo = true;
                                      vm.payment_status_message = result.error.message;
                                      vm.show_loading = false;
                                    }
                                  } else if(result.paymentIntent.status === 'succeeded') {
                                    // console.log('Payment successful!');
                                    //we need to let the server know the payment was successful so it can be entered into the transaction list
                                    BookoutService.CheckPayment(data.paymentID)
                                        .then(function(data){
                                            if(data.success){
                                                vm.show_loading = false;
                                                //alert("SUCCESS");
                                                vm.paymentOk = true;
                                                // console.log("About to send back to controller: ");
                                                // console.log(result.paymentIntent);
                                                vm.onConfirm({ methodLabel: 'saved-card', paymentIntent: result.paymentIntent });
                                            } else {
                                                //alert("We encountered an error - please try again");
                                                vm.paymentNo = true;
                                                vm.payment_status_message = result.error.message;
                                                // console.log("NOTHING SENT?");
                                                vm.show_loading = false;
                                            }
                                        });

                                    

                                  } else {
                                    console.log("not sure what happened - payment bit");
                                    vm.show_loading = false;
                                  }

                                  vm.show_loading = false;
                                });


                            }
            });


        }



      }]
    };
  });


app.factory('smoothScroll', function($window, $document, $timeout) {
      function scrollTo(targetY, duration) {
        duration = duration || 600;
        var startY = $window.pageYOffset,
            distanceY = targetY - startY,
            startTime = null;

        function easeInOutQuad(t) {
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        }

        function step(timestamp) {
          if (!startTime) startTime = timestamp;
          var progress = (timestamp - startTime) / duration;
          if (progress > 1) progress = 1;
          var eased = easeInOutQuad(progress);
          $window.scrollTo(0, startY + distanceY * eased);
          if (progress < 1) {
            $window.requestAnimationFrame(step);
          }
        }

        $window.requestAnimationFrame(step);
      }

      return {
        toElement: function(el, duration) {
          if (!el) return;
          var rect = el.getBoundingClientRect();
          var targetY = rect.top + $window.pageYOffset;
          scrollTo(targetY, duration);
        },
        toTop: function(duration) {
          scrollTo(0, duration);
        },
        toBottom: function(duration) {
          var targetY = $document[0].body.scrollHeight - $window.innerHeight;
          scrollTo(targetY, duration);
        }
      };
    });



app.directive('mobileSlideMenu', ['$document', '$window', function($document, $window){
  return {
    restrict: 'A',
    link: function(scope, el){

      scope.menuOpen = false;

      scope.openMenu = function(){
        scope.menuOpen = true;
      };

      scope.closeMenu = function(){
        scope.menuOpen = false;
      };

      scope.toggleMenu = function(){
        scope.menuOpen = !scope.menuOpen;
      };

      // Close when pressing ESC
      var onKeyDown = function(e){
        if (e.key === 'Escape' || e.keyCode === 27){
          scope.$applyAsync(function(){
            scope.closeMenu();
          });
        }
      };
      $document.on('keydown', onKeyDown);

      // Optional: close when resizing to desktop
      var onResize = function(){
        // If you want: close menu when leaving mobile breakpoint
        if ($window.innerWidth > 860 && scope.menuOpen){
          scope.$applyAsync(function(){
            scope.closeMenu();
          });
        }
      };
      angular.element($window).on('resize', onResize);

      // Optional: close after tapping a menu item
      scope.onMenuItemClick = function($event){
        // if you're using href="", prevent jump
        if ($event && $event.preventDefault) $event.preventDefault();
        scope.closeMenu();
      };

      // Cleanup listeners
      scope.$on('$destroy', function(){
        $document.off('keydown', onKeyDown);
        angular.element($window).off('resize', onResize);
      });
    }
  };
}]);


angular.module('app').directive('uibTimepicker', function(uibDateParser) {
  return {
    require: 'ngModel',
    link: function(scope, element, attrs, ngModel) {

      ngModel.$formatters.push(function(value) { // view
        if(!value) { return value; }

        return uibDateParser.fromTimezone(value, 'UTC');
      });

      ngModel.$parsers.push(function(value) { // model
        if(!value) { return value; }

        return uibDateParser.toTimezone(value, 'UTC');
      });

    }
  };
});