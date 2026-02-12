 app.controller('DashboardClubInvoicesController', DashboardClubInvoicesController);

    DashboardClubInvoicesController.$inject = ['$sce', 'PaymentService', 'UserService', 'ClubService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'BookingService', 'LicenceService', 'ClubDocumentService', 'PlaneDocumentService', '$http', 'ToastService'];
    function DashboardClubInvoicesController($sce, PaymentService, UserService, ClubService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, BookingService, LicenceService, ClubDocumentService, PlaneDocumentService, $http, ToastService) {
        
        var vm = this;

        vm.clubs = [];
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;
        
        vm.club_id = vm.user.current_club_admin.id;

        vm.to_date = new Date();
        vm.from_date = new Date();

        vm.from_date.setMonth(vm.from_date.getMonth() - 1);


        vm.show_pay_now = false;
        vm.show_loading = false;

        vm.last_invoice_opened = {};


        var iconBank = '<svg viewBox="0 0 24 24"><path d="M3 10h18M4 10V8l8-5 8 5v2M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M2 20h20" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconCard = '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" ry="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M2 9h20M6 14h6" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconNew  = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M12 8v8M8 12h8" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconTerm = '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="14" rx="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="8" y="5" width="8" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="9" y="10" width="6" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        
          vm.donConfirm = function(methodLabel, paymentIntent){
            // console.log("confirmation is called", methodLabel);
            // console.log("paymentIntent", paymentIntent);
          //alert('Parent received D confirmation: ' + methodLabel);
            vm.complete_invoice(methodLabel, paymentIntent);
          };

          vm.default_payment = 'direct-debit';

          vm.methods = [
            { id: 'direct-debit', title: 'Direct Debit', subtitle: 'Use your BACS mandate', type: 'direct-debit', iconSvg: $sce.trustAsHtml(iconBank), visible: true },
            { id: 'saved-card',   title: 'Saved card',   subtitle: 'Use a card on file',    type: 'saved-card',  iconSvg: $sce.trustAsHtml(iconCard), visible: true },
            { id: 'new-card',     title: 'New card',     subtitle: 'Add a new debit/credit card', type: 'new-card', iconSvg: $sce.trustAsHtml(iconNew), visible: false },
            { id: 'card-machine', title: 'Card Machine', subtitle: 'Pay in person',          type: 'card-machine', iconSvg: $sce.trustAsHtml(iconTerm), visible: true }
          ];

           vm.savedCards = [];

           vm.complete_invoice = function(method, paymentIntent){

               //we now have a payment to complete
               //process_payment

               var obj = {
                   user_id: vm.last_invoice_opened.user_id,
                   club_id: vm.last_invoice_opened.club_id,
                   paymentIntent: paymentIntent,
                   invoice_id: vm.last_invoice_opened.id,
                   method: method
               }

               PaymentService.ProcessPayment(obj)
                   .then(function (data) {

                       if(data.success){

                           //finish with:
                           //RELOAD THE INVOICES!!!
                           ClubService.GetClubInvoices(vm.club_id, vm.from_date, vm.to_date)
                            .then(function (data) {
                                   console.log("data is : ", data);
                                   vm.invoices = data.invoices;
                                   vm.totals = data.totals;

                                   vm.show_pay_now = false;
                                   vm.show_loading = false;
                                   //alert("SUCCESS!");


                                });

                           

                       } else {
                          // alert("Something happened which was not supposed to happen... Please try again");
                           console.log("===== ERROR =====");
                           console.log(data);
                           console.log("===== ERROR =====");
                       }


                   });

           }

           vm.close_pay_now = function(){
               vm.show_pay_now = false;
               vm.show_loading = false;
           }

           vm.show_payment_option = function(invoice){
            var status = invoice.status;
            if(status == "pending_submission"){
                return true;
            } else if(status == "issued"){
                return true;
            } else {
                return false;
            }

        }

        vm.info;

        vm.show_payment = function(invoice){
            console.log("invoice details: ", invoice);
            vm.last_invoice_opened = invoice;
            vm.send = {
                club_id: invoice.club_id,
                user_id: invoice.user_id,
                invoice_id: invoice.id
            }

            //get user cards
            //get user info

            MemberService.GetMandate(invoice.user_id, invoice.club_id)
                    .then(function (data) {
                            ////console.log("data is : ", data);
                           
                    if(data.success){
                        vm.info = data.info;

                        vm.savedCards = data.cards;

                        if(vm.savedCards.length > 0){
                            vm.methods[1].visible = true;
                        } else {
                            vm.methods[1].visible = false;
                        }

                        vm.machine = data.machine;
                        if(vm.machine.success){
                            vm.methods[3].visible = true;
                        } else {
                            vm.methods[3].visible = false;
                        }

                        vm.show_pay_now = true;
                    }

                });

           

        }




        // console.log("GLOBALS", $rootScope.globals);
        // console.log("USER", vm.user.current_club_admin.id);

        vm.get_package_html = function(pack_obj){



                            var used_on = "";
                            for(var i=0;i<pack_obj.aircraft.length;i++){
                                used_on = used_on + " " + pack_obj.aircraft[i].registration +" ("+ pack_obj.aircraft[i].plane_type +") <br />";
                            }
                            var text = "";
                            if(pack_obj.validity == 0){
                               text = "Package purchased on: "+moment(pack_obj.created_at).format("D MMM Y")+"<br /> Package does not expire <br /> To be used on:<br />";
                            } else {
                               text = "Package purchased on: "+moment(pack_obj.created_at).format("D MMM Y")+"<br /> Package expires on: "+ moment(pack_obj.created_at).add(pack_obj.validity, "days").format("D MMM Y") +" <br /> To be used on:<br />";
                            }
                    
                            var intro =  text+used_on;


                            // bit = bit + '<h4 uib-tooltip="'+intro+'"> '+package.title+' <i class="fa fa-question-circle"></i></h4><div class="dual_solo"><div class="dual" uib-tooltip="Hours remaining on this package to fly dual (with an instructor)"><span class="bigger_text">'+vm.convert_decimal_to_hours( package.remaining_hours_dual )+'</span><span class="smaller_text">DUAL</span></div><div class="solo" uib-tooltip="Hours remaining on this package of solo rental"><span class="bigger_text">'+vm.convert_decimal_to_hours( package.remaining_hours_solo )+'</span><span class="smaller_text">SOLO</span></div></div>';


                            
                            return intro;

        }
        vm.quick_select = {};
        vm.base_date = new Date();
        vm.yesterday = new Date();
        vm.sevendaysago = new Date();
        vm.thirtydaysago = new Date();
        vm.yesterday.setDate(vm.yesterday.getDate() - 1);
        vm.sevendaysago.setDate(vm.yesterday.getDate() - 7);
        vm.thirtydaysago.setDate(vm.yesterday.getDate() - 30);

        function getMonday(d) {
          var date = new Date(d);
          const day = date.getDay();
          const diff = date.getDate() - day + (day === 0 ? -6 : 1);
          return new Date(d.setDate(diff));
        }
        function getSunday(d){
            const sunday = new Date(d)
            sunday.setDate(sunday.getDate() + 6);
            return sunday;
        }

        var date = new Date();
        var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        var lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        var lm_firstDay = new Date(date.getFullYear(), (date.getMonth() - 1), 1);
        var lm_lastDay = new Date(date.getFullYear(), date.getMonth(), 0);
        

        vm.quick_selects = [
           {
               title: "Today",
               from_date: vm.base_date,
               to_date: vm.base_date
           },
           {
               title: "Yesterday",
               from_date: vm.yesterday,
               to_date: vm.yesterday
           },
           {
               title: "Last 7 days",
               from_date: vm.sevendaysago,
               to_date: vm.base_date
           },
           {
               title: "Last 30 days",
               from_date: vm.thirtydaysago,
               to_date: vm.yesterday
           },
           {
               title: "This week",
               from_date: getMonday(new Date()),
               to_date: getSunday(getMonday(new Date()))
           },
           {
               title: "This month",
               from_date: firstDay,
               to_date: lastDay
           },
           {
               title: "Last month",
               from_date: lm_firstDay,
               to_date: lm_lastDay
           }


        ];
        vm.update_qs = function(){
            console.log("QUICK SELECT : ");
            console.log(vm.quick_select.from_date);
            console.log(vm.quick_select.to_date);
            vm.from_date = vm.quick_select.from_date;
            vm.to_date = vm.quick_select.to_date;
            vm.update_date_range();
        }
        vm.update_date_range = function(){
            //update the invoices
            ClubService.GetClubInvoices(vm.club_id, vm.from_date, vm.to_date)
            .then(function (data) {
                   console.log("data is : ", data);
                   vm.invoices = data.invoices;
                   vm.totals = data.totals;
                });

        }
       

        vm.convert_decimal_to_hours = function(number){
            
                            var sign = (number >= 0) ? 1 : -1;

                            // Set positive value of number of sign negative
                            number = number * sign;

                            // Separate the int from the decimal part
                            var hour = Math.floor(number);
                            var decpart = number - hour;

                            var min = 1 / 60;
                            // Round to nearest minute
                            decpart = min * Math.round(decpart / min);

                            var minute = Math.floor(decpart * 60) + '';

                            // Add padding if need
                            if (minute.length < 2) {
                            minute = '0' + minute; 
                            }

                            if(minute == 60){
                                hour = hour+1;
                                minute = '00';
                            }

                            // Add Sign in final result
                            sign = sign == 1 ? '' : '-';

                            // Concate hours and minutes
                            var time = sign + hour + ':' + minute;

                            return time;

                        }

                        // var from_date = "2024-01-01";
                        // var to_date = "2024-07-01";

        ClubService.GetClubInvoices(vm.club_id, vm.from_date, vm.to_date)
            .then(function (data) {
                   console.log("data is : ", data);
                   vm.invoices = data.invoices;
                   vm.totals = data.totals;
                });


        // ClubService.GetClubTotals(vm.user.id, from_date, to_date)
        //     .then(function (data) {
        //             ////console.log("data is : ", data);
        //            vm.upcoming = data.upcoming;
        //         });
       
          
        $scope.get_icon = function(file){

                var ft = file.name;
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


            vm.get_icon2 = function(file){

                var ft = file.split('.').pop();
                // //console.log("ICON 2 : ", ft);
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

        
        $scope.search = function(row){
            //plane_registration
            ////console.log("hi", (angular.lowercase(row.title).indexOf(angular.lowercase($scope.my_search) || '') !== -1));
            if(row.plane_registration){
                if(angular.lowercase(row.plane_registration).indexOf(angular.lowercase($scope.my_search) || '') !== -1){
                    return true;
                }
            }


            return ( (angular.lowercase(row.invoice_number).indexOf(angular.lowercase($scope.my_search) || '') !== -1) || 
                    (angular.lowercase(row.user.last_name).indexOf(angular.lowercase($scope.my_search) || '') !== -1) ||
                    (angular.lowercase(row.created_at.toString()).indexOf(angular.lowercase($scope.my_search) || '') !== -1) ||
                    (angular.lowercase((parseFloat(row.total).toFixed(2)).toString()).indexOf(angular.lowercase($scope.my_search) || '') !== -1) ||
                    (angular.lowercase(row.status).indexOf(angular.lowercase($scope.my_search) || '') !== -1) );
        };

        $scope.show_more = function(index){


            vm.invoices[index].show_more = (vm.invoices[index].show_more)? false : true;


        }




        function process_payment_bits(payments){









        }


        $scope.get_human_status = function(status){

            var returned;
            switch(status){
                case 'issued':
            
                  returned = "Created";

              break;

              case 'pending_submission':
                  
                    returned = "Requesting";

              break;

              case 'submitted':
                    
                    returned = "Requested";

              break;

              case 'confirmed':
                    
                    returned = "Paid";

              break;

              case 'paid_out':
                    returned = "Paid";

              break;

              case 'failed':
                    returned = "Failed";

              break;

              case 'charged_back':
                    returned = "Charged Back";

              break;
              default:
                  returned = status;
              break
            }

            return returned;

        }

     
        $scope.downloadDocument = function(doc) {
            var data = $.param({
                id: doc
            });

            var ddd = doc.replace(/^.*[\\\/]/, '');

            $http.get('/api/v1/plane_documents/show_file/'+ddd, {
                    responseType: 'arraybuffer'
                })
                .success(function(data, status, headers) {
                    var zipName = processArrayBufferToBlob(data, headers);

                    //Delete file from temp folder in server - file needs to remain open until blob is created
                    //deleteFileFromServerTemp(zipName);
                }).error(function(data, status) {
                    ToastService.error('Download Error', 'There was an error downloading the selected document(s).');
                })
        };

        $scope.downloadInvoice = function(id) {
            // var data = $.param({
            //     id: doc
            // });

            //var ddd = doc.replace(/^.*[\\\/]/, '');

            $http.get('api/v1/invoice_pdf/get_ad_hoc_invoice/'+id, {
                    responseType: 'arraybuffer'
                })
                .success(function(data, status, headers) {
                    var zipName = processArrayBufferToBlob(data, headers);

                    //Delete file from temp folder in server - file needs to remain open until blob is created
                    //deleteFileFromServerTemp(zipName);
                }).error(function(data, status) {
                    ToastService.error('Download Error', 'There was an error downloading the selected document(s).');
                })
        };

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
                var blob = new Blob([data], {
                    type: contentType
                });
                if (navigator.msSaveBlob)
                    navigator.msSaveBlob(blob, filename);
                else {
                    // Try using other saveBlob implementations, if available
                    var saveBlob = navigator.webkitSaveBlob || navigator.mozSaveBlob || navigator.saveBlob;
                    if (saveBlob === undefined) throw "Not supported";
                    saveBlob(blob, filename);
                }
                success = true;
            } catch (ex) {
                $log.info("!!saveBlob method failed with the following exception:");
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

      



    }