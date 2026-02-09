 app.controller('ManageMyMembershipsController', ManageMyMembershipsController);

    ManageMyMembershipsController.$inject = ['UserService', 'MemberService', 'MembershipService', 'PaymentService', 'InstructorService', 'HolidayService', 'ClubService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'LicenceService', 'NokService', '$cookies', 'GoCardService', '$http', 'EnvConfig'];
    function ManageMyMembershipsController(UserService, MemberService, MembershipService, PaymentService, InstructorService, HolidayService, ClubService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, LicenceService, NokService, $cookies, GoCardService, $http, EnvConfig) {
        
        var vm = this;        

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;        
        vm.noks = [];
        vm.requests = [];
        vm.auto_renew = false;

        
    


        switch($state.current.data.action){
            case "add":

                    //vm.selected_component = vm.components[0];
                    //vm.selected_component = 

                    // //console.log("AA", vm.selected_component);
                ClubService.GetAll()
                .then(function (data) {
                    
                    vm.clubs = data;

                });
            

            break;
            case "edit":

            // //console.log("EDIT ONE");
             //console.log("PARAMS: ", $stateParams);

            // PaymentService.GetByUserId(vm.user.id)
            //     .then(function (data) {
            //         //console.log("DATA HERE", data);
            //         vm.cards = data.cards;


                    MemberService.GetOneForUser($stateParams.membership_id)
                    .then(function (data) {
                            //console.log("DATA HERE", data);
                            if(data.success){
                                vm.membership_now = data.membership;
                                vm.auto_renew = (data.membership.auto_renew == 1) ? true : false;

                                //get_member_cards
                                 var send = {
                                   user_id: vm.user.id,
                                   club_id: vm.membership_now.club_id,
                                   membership_id: $stateParams.membership_id
                               }
                                PaymentService.GetMemberCards(send)
                                .then(function (data) {

                                    console.log(data);
                                    vm.membership_now.cards = data.cards;
                                    vm.membership_now.default_card = data.default_card;

                                });



                                //vm.payment_card = vm.cards.find(item => item.id === vm.membership_now.card_id);
                            } else {
                                //console.log("woops");
                            }
                            
                            


                        });

                // });





            break;

            case "accept":

                // //console.log("EDIT ONE");
                //console.log("PARAMS: ", $stateParams);
                //$stateParams.request_id
                MembershipService.GetRequestsById($stateParams.request_id)
                    .then(function (data) {
                        if(data.success){
                            vm.this_req = data.request;
                            //console.log("REQ", vm.this_req);





                        } else {
                            //console.log("WOOOPSIES...");
                            //this should be very very rare...
                        }
                    });


                // PaymentService.GetByUserId(vm.user.id)
                //     .then(function (data) {
                //         //console.log("DATA HERE", data);
                //         vm.cards = data.cards;
                //     });



            break;
            case "list":

                //console.log("LIST ALL");

                 //1 get the user's nok...
                 //list stuff

                 MemberService.GetUserMemberships(vm.user.id)
                .then(function (data) {
                    if(data.success){
                        vm.memberships = data.memberships;
                        //console.log("memberships", vm.memberships);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

                update_requests();

                //  MembershipService.GetRequestsByUser(vm.user.id)
                // .then(function (data) {
                //     if(data.success){
                //         vm.requests = data.requests;
                //         //console.log("memberships", vm.memberships);

                //     } else {
                //         //console.log("WOOOPSIES...");
                //         //this should be very very rare...
                //     }

                // });


            break;
           
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  



        function update_requests(){
            MembershipService.GetRequestsByUser(vm.user.id)
                .then(function (data) {
                    if(data.success){
                        vm.requests = data.requests;
                        //console.log("memberships", vm.memberships);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });
        }


            $scope.popup = [];

            $scope.open = function(id, $event) {
                //console.log("THIS", id);
                //this comment would allow the event not to be affect by clicking it again... not sure this is a good idea
                if($scope.popup[id] && $scope.popup[id].opened == true){
                    $event.preventDefault();
                    $event.stopPropagation();
                } else {
                    $scope.popup[id] = {opened: true};
                }
            };

            $scope.formats = ['dd/MM/yyyy', 'yyyy/MM/dd', 'dd.MM.yyyy', 'shortDate'];
            $scope.format = $scope.formats[0];

            $scope.datePickerOptions = {
                                        format: 'dd/MM/yyyy',
                                        showWeeks: false
                                    };

           

            vm.show_memberships = false;

            $scope.set_club = function(){

                vm.show_memberships = true;
                
                MembershipService.GetAllByClubAvailable(vm.club.id)
                .then(function (data) {
                    //console.log("DATA HERE", data);
                    vm.memberships = data;
                  
                });

            }

            $scope.set_default_payment_method = function(name){

                var obj = {
                    default_payment_method: name
                };

                MemberService.UpdateOneByUser($stateParams.membership_id, obj)
                .then(function (data) {
                    //console.log("ACCEPT HERE", data);


                    MemberService.GetOneForUser($stateParams.membership_id)
                    .then(function (data) {
                            //console.log("DATA HERE", data);
                            if(data.success){
                                vm.membership_now = data.membership;
                                vm.auto_renew = (data.membership.auto_renew == 1) ? true : false;

                                //get_member_cards
                                 var send = {
                                   user_id: vm.user.id,
                                   club_id: vm.membership_now.club_id,
                                   membership_id: $stateParams.membership_id
                               }
                                PaymentService.GetMemberCards(send)
                                .then(function (data) {

                                    console.log(data);
                                    vm.membership_now.cards = data.cards;
                                    vm.membership_now.default_card = data.default_card;

                                });



                                //vm.payment_card = vm.cards.find(item => item.id === vm.membership_now.card_id);
                            } else {
                                //console.log("woops");
                            }
                            
                            


                        });



                    //$state.go('dashboard.my_account.memberships', {}, {reload: true});
                });

            }

            $scope.make_default_card = function(card){
                var a = confirm("Are you sure you wish to make this card the default card?");

                if(a){
                    var send = {user_id: vm.user.id, club_id: vm.membership_now.club_id, card_id: card.stripe_id};
                    PaymentService.UpdateDefaultCard(send)
                    .then(function (data) {
                        console.log("DATA HERE", data);
                        if(data.success){
                            //update the card list!
                            vm.membership_now.cards = data.cards;
                            vm.membership_now.default_card = data.default_card;
                        }
                      
                    });
                }
            }

            $scope.delete_member_card = function(card){

                var a = confirm("Are you sure you wish to delete this card?");

                if(a){
                    var send = {user_id: vm.user.id, club_id: vm.membership_now.club_id, card_id: card.stripe_id};
                    PaymentService.DeleteMemberCard(send)
                    .then(function (data) {
                        console.log("DATA HERE", data);
                        if(data.success){
                            //update the card list!
                            PaymentService.GetMemberCards(send)
                                    .then(function (data) {
                                        // console.log(data);
                                        vm.membership_now.cards = data.cards;

                                    });
                        }
                      
                    });
                }

                
            }

            $scope.delete_request = function(id){
                MembershipService.DeleteRequest(id)
                .then(function (data) {
                    //console.log("DELETE HERE", data);
                    //vm.memberships = data;
                    update_requests();
                }); 
            }


            $scope.set_membership = function(){

                vm.show_confirmation = true;
                
                PaymentService.GetByUserId(vm.user.id)
                .then(function (data) {
                    //console.log("DATA HERE", data);
                    vm.cards = data.cards;
                  
                });

            }


            $scope.set_card = function(){

              
                

            }


            $scope.accept_it = function(){

                if(!vm.club_tnc){
                    alert("You need to access the terms of the flight organisation prior to continuing!");
                    return false;
                }

                //basic checks...
                var obj = {
                    club_id: vm.this_req.club_id,
                    user_id: vm.user_id,
                    request_id: vm.this_req.id
                };

                MembershipService.AcceptRequest(vm.this_req.id, obj)
                .then(function (data) {
                    ////console.log("ACCEPT HERE", data);

                    $cookies.put('gcl_sess', data.mandate.session);
                    $cookies.put('gcl_member_accepted', true);

                    window.location = data.mandate.link;

                    //vm.memberships = data;
                    // update_requests();
                    //     $state.go('dashboard.my_account.memberships', {}, {reload: true});
                }); 

            }

            $scope.update_it = function(){

                var obj = {
                    auto_renew: (vm.auto_renew == true)? 1 : 0
                };

                MemberService.UpdateOneByUser($stateParams.membership_id, obj)
                .then(function (data) {
                    //console.log("ACCEPT HERE", data);
                    //vm.aut
                    //$state.go('dashboard.my_account.memberships', {}, {reload: true});
                });

            }


            $scope.edit_membership = function(id){

                //console.log("update membership");
                $state.go('dashboard.my_account.memberships.edit', {membership_id: id});

            }


            $scope.create_direct_debit = function(){

                


            }

            var update_request = false;
            vm.change_direct_debit = function(){
                if(!update_request){

                   ////console.log("UPDATE");

                   var update_mandate_details = {
                       user_id: vm.user.id,
                       club_id: vm.membership_now.club_id,
                       membership_id: $stateParams.membership_id
                   }

                   ////console.log("to send", update_mandate_details);

                   GoCardService.GenerateUpdateLink(update_mandate_details)
                   .then(function (data) {
                    ////console.log("ACCEPT HERE", data);
                    if(data.success){
                        $cookies.put('gcl_sess', data.session);
                        $cookies.put('gcl_member_accepted', true);

                        window.location = data.link;
                        
                    } else {
                        alert("An error occurred when generating the link to update your direct debit instructions - please contact support@toaviate.com");
                    }
                   

                    //vm.memberships = data;
                    // update_requests();
                    //     $state.go('dashboard.my_account.memberships', {}, {reload: true});
                }); 




                } else {
                    //console.log("putting the request on hold");
                }


            }

          
            vm.show_add_card = false;

            $scope.add_card = function(){

                console.log("ADD A CARD HERE!!");
                var send = {
                    club_id: vm.membership_now.club_id,
                    user_id: vm.user.id
                }

                vm.show_add_card = true;

                PaymentService.CreateNewCustomer(send)
                .then(function (data) {
                    console.log("DATA HERE", data);
                    // Initialize Stripe.js
                    var stripe = Stripe(EnvConfig.getStripeKey());

                    const options = {
                      clientSecret: data.secret,
                      // Fully customizable with appearance API.
                      appearance: {/*...*/},
                    };

                    // Set up Stripe.js and Elements using the SetupIntent's client secret
                    const elements = stripe.elements(options);

                    // Create and mount the Payment Element
                    const paymentElementOptions = { layout: 'tabs'};
                    const paymentElement = elements.create('payment', paymentElementOptions);
                    paymentElement.mount('#payment-element');



                    const form = document.getElementById('payment-form');

                    form.addEventListener('submit', async (event) => {
                      event.preventDefault();

                      const {error} = await stripe.confirmSetup({
                        //`Elements` instance that was used to create the Payment Element
                        elements,
                        confirmParams: {
                          return_url: window.location.href,
                        }
                      });

                      if (error) {
                        // This point will only be reached if there is an immediate error when
                        // confirming the payment. Show error to your customer (for example, payment
                        // details incomplete)
                        const messageContainer = document.querySelector('#error-message');
                        messageContainer.textContent = error.message;
                      } else {
                        // Your customer will be redirected to your `return_url`. For some payment
                        // methods like iDEAL, your customer will be redirected to an intermediate
                        // site first to authorize the payment, then redirected to the `return_url`.
                      }
                    });




                });

               //  //setup the js to show the card addition form
               // PaymentService.CreatePaymentIntent(send)
               //  .then(function (data) {
               //      console.log("DATA HERE", data);
               //      vm.show_add_card = true;

               //      var fetched_secret = data.clientSecret;
               //      // Initialize Stripe.js
               //      var stripe = Stripe('pk_test_51QttFFG8WiGSRCORyxkdZTO8oajcqz9OUsvcDJFpr9FB2PAdbzJc0tS7WNnfzKYsTiqHN1YDZi5UtXk4K52SeD4h00YWXuChNd');

               //      // Initialize Checkout
                     

                    

               //          var checkout = stripe.initEmbeddedCheckout({
               //              clientSecret: fetched_secret,
               //          }).then(function(checkout){
               //                checkout.mount('#checkout');
               //              //   const options = { layout: 'accordion', clientSecret: fetched_secret /* options */ };

               //              //   const appearance = {
               //              //       theme: 'flat',
               //              //       variables: { colorPrimaryText: '#262626' },
               //              //       clientSecret: fetched_secret
               //              //     };
               //              //   const elements = stripe.elements(appearance, {clientSecret: fetched_secret});
               //              // const paymentElement = elements.create('payment', options);
               //              // paymentElement.mount('#checkout');
               //          });

                         
                            
                         


                   
               //        // Mount Checkout
               //        //checkout.mount('#checkout');

               //      ///vm.cards = data.cards;
                  
               //  });
                





            }

            vm.try_charge_default_card = function(){
                alert("GO TIME", vm.membership_now.cards[1].stripe_id);
                var invoice_id = 55;
                var send_me = {
                    invoice_id: 55,
                    card_id: vm.membership_now.cards[1].stripe_id,
                    last4: vm.membership_now.cards[1].last4
                }
                PaymentService.CreatePaymentIntent(send_me).then(function (data) {
                    console.log("DATA IS : ", data);

                });

            }

            $scope.save_added_card = function(){

                 var update_mandate_details = {
                       user_id: vm.user.id,
                       club_id: vm.membership_now.club_id,
                       membership_id: $stateParams.membership_id
                }

                vm.show_add_card = false;

            }


             $scope.get_icon = function(file){

                var ft;
                if(file && file.name){
                     ft = file.name;
                } else {
                    ft = file;
                }

                if(!ft){
                    ft = "other.other";
                }


                ft = ft.split('.').pop();
                var icon_name = "";

                // //console.log("FILE:", ft);
                // //console.log("index : ", ft.indexOf("pdf"));
                switch(true){
                    case (ft.indexOf("pdf") > -1):
                        icon_name = "pdf.png";
                    break;
                    case (ft.indexOf("doc") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("docx") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("xls") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("xlsx") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("ppt") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("pptx") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("jpg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("jpeg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("png") > -1):
                        icon_name = "png.png";
                    break;
                    case (ft.indexOf("gif") > -1):
                        icon_name = "gif.png";
                    break;
                    case (ft.indexOf("zip") > -1):
                        icon_name = "zip.png";
                    break;
                    case (ft.indexOf("avi") > -1):
                        icon_name = "avi.png";
                    break;
                    case (ft.indexOf("mp4") > -1):
                        icon_name = "mp4.png";
                    break;
                    default:
                        icon_name = "file.png";
                    break;
                }

                // //console.log("FILE:", icon_name);

                return "images/file_icons/"+icon_name;
            }






        $scope.downloadClubDocument = function(doc) {
            var data = $.param({
                id: doc
            });
            if(!doc){
                alert("Sorry - it looks like this flight organisation hasn't yet uploaded their document - please contact them to upload it to ToAviate.");
                return false;
            }
            var ddd = doc.replace(/^.*[\\\/]/, '');

            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";

            $http.get('api/v1/term_documents/show_file/'+ddd, {
                    responseType: 'arraybuffer'
                })
                .success(function(data, status, headers) {
                    var zipName = processArrayBufferToBlob(data, headers);

                    //Delete file from temp folder in server - file needs to remain open until blob is created
                    //deleteFileFromServerTemp(zipName);
                }).error(function(data, status) {
                    alert("This file is not available at the moment - please contact the flight organisation.");
                })
        };

        function titlepath(path,name){

        //In this path defined as your pdf url and name (your pdf name)
            var prntWin = window.open();
            prntWin.document.write("<html><head><title>"+name+"</title></head><body>"
                + '<embed width="100%" height="100%" name="plugin" src="'+ path+ '" '
                + 'type="application/pdf" internalinstanceid="21"></body></html>');
            prntWin.document.close();
        }

        function processArrayBufferToBlob(data, headers) {
            var octetStreamMime = 'application/octet-stream';
            var success = false;

            // Get the headers
            headers = headers();
            //var ttt = title.toLowerCase().replace(/\W/g, '_');
            // Get the filename from the x-filename header or default to "download.bin"
            var filename = headers['x-filename'] || 'download.zip';

            // Determine the content type from the header or default to "application/octet-stream"
            var contentType = headers['content-type'] || octetStreamMime;

            try {
                // Try using msSaveBlob if supported
                var blob = new Blob([data], 
                    //type: contentType
                    {type: 'application/pdf'}
                //}
                );


                var fileURL = URL.createObjectURL(blob);
                //window.open(fileURL);
                titlepath(fileURL, "Secure Documents");

                // if (navigator.msSaveBlob)
                //     navigator.msSaveBlob(blob, filename);
                // else {
                //     // Try using other saveBlob implementations, if available
                //     var saveBlob = navigator.webkitSaveBlob || navigator.mozSaveBlob || navigator.saveBlob;
                //     if (saveBlob === undefined) throw "Not supported";
                //     saveBlob(blob, filename);
                // }
                success = true;
            } catch (ex) {
                $log.info("saveBlob method failed with the following exception:");
                $log.info(ex);
            }

            if (!success) {
                // Get the blob url creator
                var urlCreator = window.URL || window.webkitURL || window.mozURL || window.msURL;
                if (urlCreator) {
                    // Try to use a download link
                    var link = document.createElement('a');
                    if ('download' in link) {
                        // Try to simulate a click
                        try {
                            // Prepare a blob URL
                            var blob = new Blob([data], {
                                type: contentType
                            });
                            var url = urlCreator.createObjectURL(blob);
                            link.setAttribute('href', url);

                            // Set the download attribute (Supported in Chrome 14+ / Firefox 20+)
                            link.setAttribute("download", filename);

                            // Simulate clicking the download link
                            var event = document.createEvent('MouseEvents');
                            event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
                            link.dispatchEvent(event);
                            success = true;

                        } catch (ex) {
                            $log.info("Download link method with simulated click failed with the following exception:");
                            $log.info(ex);
                        }
                    }

                    if (!success) {
                        // Fallback to window.location method
                        try {
                            // Prepare a blob URL
                            // Use application/octet-stream when using window.location to force download
                            var blob = new Blob([data], {
                                type: octetStreamMime
                            });
                            var url = urlCreator.createObjectURL(blob);
                            window.location = url;
                            success = true;
                        } catch (ex) {
                            $log.info("Download link method with window.location failed with the following exception:");
                            $log.info(ex);
                        }
                    }
                }
            }

            if (!success) {
                // Fallback to window.open method
                $log.info("No methods worked for saving the arraybuffer, using last resort window.open");
                window.open(httpPath, '_blank', '');
            }
            return filename;
        };










            $scope.request = function(){

                //basic checks...
          


              if(vm.club_tnc && vm.card_tnc && vm.club.id && vm.membership.id){
                alert("THANK YOU");

                var obj = {
                    user_id: vm.user.id,
                    club_id: vm.club.id,
                    membership_id: vm.membership.id,
                    requested_by: "user",
                    paid: 0
                    //,card_id: vm.payment_card.id
                };

                MembershipService.SendRequest(obj)
                .then(function (data) {
                    // //console.log("SENT HERE", data);
                    if(data.success){
                        //$state.go('dashboard.my_account.memberships');

                        // //console.log("DATA", data);
                        // //console.log(data.mandate.link);
                        $cookies.put('gcl_sess', data.mandate.session);


                        window.location = data.mandate.link;


                    }

                });




              } else {
                alert("Please fill all fields...");
              }

            }





        
        


    }