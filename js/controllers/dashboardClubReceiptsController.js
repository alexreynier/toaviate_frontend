 app.controller('DashboardClubReceiptsController', DashboardClubReceiptsController);

    DashboardClubReceiptsController.$inject = ['UserService', 'PlaneService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'LicenceService', 'MedicalService', 'DifferencesService', 'ItemService', '$sce', 'ToastService'];
    function DashboardClubReceiptsController(UserService, PlaneService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, LicenceService, MedicalService, DifferencesService, ItemService, $sce, ToastService) {
        var vm = this;

        vm.user = null;
        vm.allUsers = [];
        vm.club = {};
        vm.page_title = "";
        
        vm.plane_document = {};
        vm.plane_documents = [];

        var update_this_file = [];
        

        vm.action = $state.current.data.action;
        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;
        ////console.log("club_id : "+vm.club_id);

        // //console.log(vm.action);
        // //console.log($stateParams);
        // //console.log($stateParams.id);
        
        PlaneService.GetCurrencies(vm.club_id)
         .then(function(data){
                        vm.currencies = data.currencies;   
                        vm.club_currency = data.club_currency;

                    });



        vm.current_offset = 0;
        vm.loaded_per_batch = 10;
        vm.all_loaded = false;

        PlaneService.GetReceiptsClub(vm.club_id, vm.current_offset, vm.loaded_per_batc)
                    .then(function(data){
                        vm.receipts = data.receipts;   
                           
                           //check for modded
                           vm.receipts.forEach(receipt => {
                               vm.verify_reimbursement(receipt);
                           })

                    });

        vm.load_more = function(){
                vm.current_offset = vm.current_offset + vm.loaded_per_batch;
                PlaneService.GetReceiptsClub(vm.club_id, vm.current_offset, vm.loaded_per_batch)
                .then(function (data) {
                        // //console.log("ALL is : ", data);
                        if(data.receipts.length > 0){
                            data.receipts.forEach(receipt => vm.receipts.push(receipt));
                        } else {
                            vm.all_loaded = true;
                        }
                       //vm.logs = data.logs;


                    });

            }
            

        vm.show_receipt_image = function(receipt){

            vm.show_receipt = true;
            vm.receipt_image = receipt.image;

        }

        $scope.get_currency = function(iso_code){

           return $.grep(vm.currencies, function(e){ 
                        return e.iso_code == iso_code; 
                    })[0];

        }
        //'9' needs to refer the the user's account set to manage
       

        vm.update_price = function(receipt){
            //console.log("change price", receipt.modified_price);
            var obj = {
                modified_price: receipt.modified_price
            };
            PlaneService.UpdateReceipt(receipt.id, obj)
            .then(function(data){
                //console.log("UPDATE ::: ", data);

                //maybe that's where we re-calculate the price?

                vm.verify_reimbursement(receipt);

            });
        }

        vm.verify_reimbursement = function(receipt){
            //console.log("WE GET HERE VERIFY REIMBURSEMENT");
            // receipt.reimbursed_amount = 12.5;
            // //console.log("receipt", receipt);
            if(receipt.modified_price && !receipt.modified_currency){
                receipt.modified_reimbursed_amount = receipt.modified_price;
                receipt.modified_reimbursed_difference = parseFloat(parseFloat(receipt.modified_reimbursed_amount) - parseFloat(receipt.reimbursed_amount));
            } else if((!receipt.modified_price || !receipt.modified_currency) || receipt.reimbursement == 0){
                return false;
            }

            //console.log("WE GET THERE");

            var receipt = $.grep(vm.receipts, function(e){ 
                        return e.id == receipt.id; 
                    })[0];

            var obj = {
                club_id: receipt.club_id,
                currency: (receipt.modified_currency)? receipt.modified_currency : receipt.currency,
                price: (receipt.modified_price) ? receipt.modified_price : receipt.price,
                requested_at: receipt.created_at
            }
            PlaneService.CheckReimbursement(obj)
            .then(function(data){
                ////console.log("CHANGE ::: ", data.reimburse.reimbursed_amount);

                //maybe that's where we re-calculate the price?
                receipt.modified_reimbursed_amount = data.reimburse.reimbursed_amount;
                receipt.modified_reimbursed_rate = data.reimburse.rate;

                //currency is always the same
                receipt.modified_reimbursed_difference = parseFloat(parseFloat(receipt.modified_reimbursed_amount) - parseFloat(receipt.reimbursed_amount));
                if(receipt.modified_reimbursed_difference == 0){
                    receipt.modified_reimbursed_difference = 0;
                    // //console.log("TOTAL CHANGE IS : ", receipt.modified_reimbursed_difference)
                }
                    // //console.log("TOTAL CHANGE IS : ", receipt.modified_reimbursed_difference)

            });




        }


        vm.modified_reimbursement_tooltip = function(receipt){

            var currency = (receipt.modified_currency) ? receipt.modified_currency : receipt.currency;
            var price = (receipt.modified_price) ? parseFloat(receipt.modified_price).toFixed(2) : parseFloat(receipt.price).toFixed(2);

            var added_currency = currency+""+parseFloat(price).toFixed(2);
            if((receipt.modified_currency && (receipt.modified_currency !== receipt.reimbursed_currency)) || (receipt.reimbursed_currency !== receipt.currency) && receipt.modified_reimbursed_rate){
                //currency was modified
                var datetime = moment(receipt.created_at).format("DD MMM YYYY HH:mm");
                added_currency = added_currency+" which on "+datetime+" the Transferwise currency conversion of "+parseFloat(receipt.modified_reimbursed_rate).toFixed(5)+" gave a value of "+receipt.reimbursed_currency+""+parseFloat(receipt.modified_reimbursed_amount).toFixed(2);
            }
            // if(receipt.)
            var reimbursing = "<br /><br /> By approving this receipt, we will automatically adjust the reimbursement by "+receipt.reimbursed_currency+""+parseFloat(receipt.modified_reimbursed_difference).toFixed(2)+" for this claim.";
            if(receipt.modified_reimbursed_difference == 0){
                reimbursing = "<br /><br /> By approving this receipt, there will be no financial charge for this change.";
            }

           return $sce.getTrustedHtml("<div>This is the amount that should have been removed from the associated invoice. <br /><br /> This is based on the receipt value of "+added_currency+". "+reimbursing+"</div>");// {{ receipt.modified_currency || receipt.currency }}{{ receipt.modified_price | number:2 || receipt.price | number:2 }}
        }

        vm.update_currency = function(receipt){
            //console.log("change currency", receipt.modified_currency);
            var obj = {
                modified_currency: receipt.modified_currency
            };
            PlaneService.UpdateReceipt(receipt.id, obj)
            .then(function(data){
                //console.log("UPDATE ::: ", data);

                //maybe that's where we re-calculate the price?
                // verify_reimbursement(data);
                // //console.log("receipts", vm.receipts);
                vm.verify_reimbursement(receipt);

            });
        }

        vm.update_invoice_no = function(receipt){
            //console.log("change currency", receipt.modified_currency);
            var obj = {
                invoice_number: receipt.invoice_number
            };
            PlaneService.UpdateReceipt(receipt.id, obj)
            .then(function(data){
                //console.log("UPDATE ::: ", data);

                //maybe that's where we re-calculate the price?
                // verify_reimbursement(data);
                // //console.log("receipts", vm.receipts);
                //vm.verify_reimbursement(receipt);

            });
        }

        vm.update_qty = function(receipt){
            //console.log("change quantity", receipt.modified_quantity);
            var obj = {
                modified_quantity: receipt.modified_quantity
            };
            PlaneService.UpdateReceipt(receipt.id, obj)
            .then(function(data){
                //console.log("UPDATE ::: ", data);
                //we don't do anything here...   
                // verify_reimbursement(data);

            });
        }





        $scope.back = function(){
            $window.history.back();
        }

        $scope.save = function(){
            if(vm.action == "add"){
                //console.log("CREATE click");
                $scope.create();
            } else {
                //console.log("EDIT click");
                //console.log(vm.club.plane);
                $scope.update();
            }
        }


        $scope.create = function(){
            //console.log("CREATE ME NOW");
            vm.club.item.club_id = vm.club_id;
            ItemService.Create(vm.club.item)
                .then(function(data){
                    //console.log(data);
                    $state.go('dashboard.manage_club.items');

                });
        }

        $scope.delete = function(){
            //console.log("CLICK");
            ToastService.warning('Confirm Delete', 'Are you sure you would like to delete this item?');
            ItemService.Delete(vm.user.id, vm.club.item)
                .then(function(data){
                    //console.log(data);
                });
        }

        function get_update_docs(){
            var documents = [];

            for(var i=0;i<update_this_file.length;i++){
                var id = update_this_file[i];
                //console.log("looking for : ", id);
                //console.log("in: ", vm.plane_documents);

                for(var k=0;k<vm.club.plane.plane_documents.length;k++){
                    //console.log("comparing to : ", vm.club.plane.plane_documents[k].id);
                    if(vm.club.plane.plane_documents[k].id == id){
                        documents.push(vm.club.plane.plane_documents[k]);
                    }
                }

            }

            // //console.log("DOCS TO UPDATE : ", documents);

            return documents;
        }

        $scope.update = function(){
            //console.log("CLICK");
            vm.club.item.club_id = vm.club_id;
            ItemService.Update(vm.club.item, vm.user.id)
                .then(function(data){
                    //console.log(data);
                    //console.log("saved");
                    $state.go('dashboard.manage_club.items');
                });
        }


        function containsObject(obj, list, params) {

            // //console.log("obj", obj);
            // //console.log("list", list);
            // //console.log("params", params);

            for(var i=0; i<list.length; i++) {
                // //console.log("list i : ", list[i]);
                // //console.log("obj is: ", obj);

                var count_success = 0;
                for(var j=0;j<params.length;j++){
                    if(list[i][params[j]] && obj[params[j]] && list[i][params[j]] == obj[params[j]]){
                        count_success++;
                    }
                }

                if(count_success === params.length) {                    
                    return true;
                }
            }

            return false;
        }


        function check_all(){

            //maybe a nice to have one day... not yet though.


            //licences
            vm.club.plane.requirements.licence.forEach(function(obj){

            });

        }

      


        $scope.add_item = function(type){
            //console.log("ADD");
            switch(type){
                case "licence":
                    //console.log("licence");
                    if(vm.temporary.licence && vm.temporary.licence !== "" && vm.temporary.rating && vm.temporary.rating !== ""){
                        //then we can add it
                        //console.log("here we go");
                        var add_licence = {
                            licence_id: vm.temporary.licence.id,
                            licence_title: vm.temporary.licence.abbreviation,
                            rating_title: vm.temporary.rating.abbreviation,
                            rating_id: vm.temporary.rating.id
                        };

                        //check if it doesnt exist first...
                        if(containsObject(add_licence, vm.club.plane.requirements.licence, new Array("licence_id", "rating_id")) == false){
                            vm.club.plane.requirements.licence.push(add_licence);
                        }

                        delete vm.temporary.licence;
                        delete vm.temporary.rating;

                    } else {
                        ToastService.warning('Selection Required', 'Please select a licence and rating that is required to book the plane solo!');
                    }

                break;


                case "medical":
                    //console.log("medical");
                    if(vm.temporary.medical_authority && vm.temporary.medical_authority !== "" && vm.temporary.medical_component && vm.temporary.medical_component !== ""){
                        //then we can add it
                        //console.log("here we go");
                        var add_medical = {
                            authority_id: vm.temporary.medical_authority.id,
                            authority_title: vm.temporary.medical_authority.abbreviation,
                            medical_component_id: vm.temporary.medical_component.id,
                            medical_component_title: vm.temporary.medical_component.title
                        };

                        //check if it doesnt exist first...
                        if(containsObject(add_medical, vm.club.plane.requirements.medical, new Array("authority_id", "medical_component_id")) == false){
                            vm.club.plane.requirements.medical.push(add_medical);
                        }

                        delete vm.temporary.medical_authority;
                        delete vm.temporary.medical_component;

                    } else {
                        ToastService.warning('Selection Required', 'Please select a medical that is required to book the plane solo!');
                    }

                break;


                case "differences":
                    //console.log("difference");
                    if(vm.temporary.difference && vm.temporary.difference !== ""){
                        //then we can add it
                        //console.log("here we go");
                        var add_difference = {
                            difference_id: vm.temporary.difference.id,
                            difference_title: vm.temporary.difference.title
                        };

                        //check if it doesnt exist first...
                        if(containsObject(add_difference, vm.club.plane.requirements.differences, new Array("difference_id", "difference_title")) == false){
                            vm.club.plane.requirements.differences.push(add_difference);
                        }

                        delete vm.temporary.difference;

                    } else {
                        ToastService.warning('Selection Required', 'Please select a difference that is required to book the plane solo!');
                    }

                break;


            }



        }




        $scope.remove_item = function(type, index){
            //console.log("REMOVE");

            vm.club.plane.requirements[type].splice(index, 1);


            // switch(type){
            //     case "licence":
            //             //console.log("licence");
                   
            //             //check if it doesnt exist first...
            //             // if(containsObject(add_licence, vm.club.plane.requirements.licence, new Array("licence_id", "rating_id")) == false){
            //             //     vm.club.plane.requirements.licence.push(add_licence);
            //             // }

            //             vm.club.plane.requirements.licence.splice(index, 1);
                      
                   

            //     break;


            //     case "medical":
            //         //console.log("medical");
            //         if(vm.temporary.medical_authority && vm.temporary.medical_authority !== "" && vm.temporary.medical_component && vm.temporary.medical_component !== ""){
            //             //then we can add it
            //             //console.log("here we go");
            //             var add_medical = {
            //                 authority_id: vm.temporary.medical_authority.id,
            //                 authority_title: vm.temporary.medical_authority.abbreviation,
            //                 medical_component_id: vm.temporary.medical_component.id,
            //                 medical_component_title: vm.temporary.medical_component.title
            //             };

            //             //check if it doesnt exist first...
            //             if(containsObject(add_medical, vm.club.plane.requirements.medical, new Array("authority_id", "medical_component_id")) == false){
            //                 vm.club.plane.requirements.medical.push(add_medical);
            //             }

            //             delete vm.temporary.medical_authority;
            //             delete vm.temporary.medical_component;

            //         } else {
            //             alert("Please select a medical that is required to book the plane solo!");
            //         }

            //     break;


            //     case "differences":
            //         //console.log("difference");
            //         if(vm.temporary.difference && vm.temporary.difference !== ""){
            //             //then we can add it
            //             //console.log("here we go");
            //             var add_difference = {
            //                 difference_id: vm.temporary.difference.id,
            //                 difference_title: vm.temporary.difference.title
            //             };

            //             //check if it doesnt exist first...
            //             if(containsObject(add_difference, vm.club.plane.requirements.differences, new Array("difference_id", "difference_title")) == false){
            //                 vm.club.plane.requirements.differences.push(add_difference);
            //             }

            //             delete vm.temporary.difference;

            //         } else {
            //             alert("Please select a difference that is required to book the plane solo!");
            //         }

            //     break;


            // }



        }
















        $scope.update_this_file = function(file){
            //console.log("==== update is : ", file.id);
            if(update_this_file.indexOf(file.id) === -1){
                update_this_file.push(file.id)
            } else {
               ////console.log("This item already exists"); 
            } 
        }


         $scope.remove_real_file = function(file){

                //remove_file

                vm.club.plane.plane_documents = $.grep(vm.club.plane.plane_documents, function(e){ 
                        return e.id != file.id; 
                    });

                //no need to actually remove the file as it will be archived accordingly on the backend whilst it is missing! :)
                PlaneDocumentService.Delete(vm.user.id, file.id)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.plane_documents = [];
                        //and re-process available files
                        $scope.processFiles(current_files);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

          }


          
          $scope.remove_file = function(file, current_files){

            //remove_file
            var j = JSON.parse(file.file_return);
            //console.log("REMOVE: ", j);
            //console.log("REMOVE: ", j.saved_url);

            //to delete the temp file created: j.saved_url
            //tmp_rm.php POST tmp = filename
            
            PoidService.DeleteTmp(j.saved_url)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.plane_documents = [];
                        //and re-process available files
                        $scope.processFiles(current_files);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

          }
          

          // $scope.$on('flow::fileAdded', function (event, $flow, flowFile) {
          //     event.preventDefault();//prevent file from uploading
          //     //console.log("FILE ADDED");
          //     //console.log($flow);
          //   });

            $scope.processFiles = function(files){
                // //console.log("files", files);

                for(var i=0; i<files.length; i++){
                    // //console.log("JSON", files[i].file_return);
                    var j = JSON.parse(files[i].file_return);
                    // //console.log("PARSED", j);
                    //console.log("J is : ",j);
                    //console.log("name is : ", j.files.file.name);

                    files[i].file.temp_path = j.saved_url;
                    files[i].file.save_name = j.files.file.name;
                    var ft = j.files.file.name;
                    ft = ft.split('.').pop();
                    files[i].file.extension = ft;

                    // //console.log("file", files[i].file);
                    vm.plane_documents.push(files[i].file);
                }


            }

            $scope.set_title = function(file){
                //console.log("return", file);
                return file.save_name;
            }

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


            $scope.get_icon2 = function(file){

                var ft = file.split('.').pop();
                //console.log("ICON 2 : ", ft);
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


            $scope.get_icon3 = function(file){

                var ft = file.split(';')[0];
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


            vm.approve_receipt_final = function(receipt){
                //console.log("APPROVED THE RECEIPT");
                //time to make a call to an API endpoint
                delete receipt.image;
                PlaneService.ApproveReceipt(receipt.id, receipt)
                .then(function(data){
                    //console.log("data", data);
                    if(data.success){
                        //we need to remove that one from the list
                        vm.receipts.splice(vm.receipts.findIndex(function(i){
                                            return i.id === receipt.id;
                                        }), 1);

                        vm.show_popup = false;
                        vm.current_receipt = {};
                    } else {
                        ToastService.error('Approval Error', 'An error occurred: ' + data.message);
                        vm.show_popup = false;
                        vm.current_receipt = {};
                    }
                });
            }   

            vm.reject_receipt_final = function(receipt){
                //console.log("REJECT THE RECEIPT");
                //time to make a call to an API endpoint
                
                delete receipt.image;
                PlaneService.RejectReceipt(receipt.id, receipt)
                .then(function(data){
                    ////console.log("data", data);
                    if(data.success){
                        //we need to remove that one from the list
                        vm.receipts.splice(vm.receipts.findIndex(function(i){
                                            return i.id === receipt.id;
                                        }), 1);

                        vm.show_popup = false;
                        vm.current_receipt = {};
                    } else {
                        ToastService.error('Rejection Error', 'An error occurred: ' + data.message);
                        vm.show_popup = false;
                        vm.current_receipt = {};
                    }
                });

            }    


            $scope.approve_receipt = function(receipt){
                //console.log("RECEIPT: ", receipt);
                vm.current_receipt = receipt;

                if(vm.current_receipt.modified_reimbursed_amount > 0){
                    vm.show_popup = 'approve';



                } else {

                    //this is where we bypass the popup

                    vm.approve_receipt_final(receipt);



                }




            }

            $scope.reject_receipt = function(receipt){
                //console.log("RECEIPT: ", receipt);
                vm.current_receipt = receipt;

                vm.show_popup = 'reject';



            }

            $scope.close_popup = function(){
                vm.show_popup = false;
                vm.current_receipt = {};
            }


            $scope.delete_poid = function(id){

              
                var a = prompt("Are you sure you wish to delete this poid? \n\n This change is irreversible! To confirm please type YES in the box below.");
                if(a == "YES"){


                    //console.log("WE DELETE IT");


                    // PoidService.Delete(vm.user_id, id)
                    //     .then(function (data) {
                    //         //console.log(data);
                    //         if(data.success){
                    //             //console.log("HUZZAH", data);
                    //             //then we need to remove this from the list of files...
                    //             vm.user_poids = $.grep(vm.user_poids, function(e){ 
                    //                 return e.id != id; 
                    //             });
                                
                    //             //refresh?
                    //             $state.reload();
                    //             $state.go('dashboard.my_account.poid');

                    //         } else {

                    //             alert("Something went terribly wrong... \n\n "+data.message);

                    //         }

                    //     });



                } else {
                    //console.log("ignore123");
                }


            }




            $scope.save_plane_documents = function(){

               
              

                //console.log("plane_documents: ", vm.plane_documents);


                //compile the required elements YAY

                //console.log("plane_document ", vm.plane_document);


                 //clean shizzle before sending
                 //why keep sending back heavy data?

                    // for(var i=0;i<vm.plane_document.images.length;i++){
                    //     delete vm.plane_document.images[i].data_uri;
                    // }

                    // // vm.plane_document.images = vm.plane_documents;
                    // vm.plane_document.images = vm.plane_document.images.concat(vm.plane_documents);
                    // vm.plane_document.user_id = vm.user_id;




            //     if(vm.plane_document.id){
            //         //then its an udpate

            //         //merge the images left?
            //         PoidService.Update(vm.plane_document)
            //             .then(function (data) {
            //                 //console.log(data);
            //                 if(data.success){
            //                     //console.log("HUZZAH", vm.plane_document);
            //                     //console.log("HUZZAH", data);
            //                     //then we need to remove this from the list of files...
                                
                                
            //                     //move somewhere?
            //                     $state.go('dashboard.my_account.poid', {}, { reload: true });





            //                 } else {

            //                     alert("Something went terribly wrong... \n\n "+data.message);

            //                 }

            //             });

            //     } else {


                   


            //         //then its a create
            //         //console.log(vm.plane_document);

            //         PoidService.Create(vm.plane_document)
            //             .then(function (data) {
            //                 //console.log(data);
            //                 if(data.success){
            //                     //console.log("HUZZAH", vm.plane_document);
            //                     //console.log("HUZZAH", data);
            //                     //then we need to remove this from the list of files...
                                
                                
            //                     //move somewhere?
            //                    // $state.reload();
            //                    // $state.go('dashboard.my_account.poid', {}, { reload: true });


            //                 } else {

            //                     alert("Something went terribly wrong... \n\n "+data.message);

            //                 }

            //             });


            //     }



             };




             $scope.change_file_name = function(file){
                
                //this is terribly ineficient... unfortunately... can't 
                //work out how else to do it! (lol)

                // //console.log("TO BE CHANGED", file);

                // //console.log("BEFORE BEFORE", vm.plane_documents);

                vm.plane_documents = $.grep(vm.plane_documents, function(e){ 
                    return e.temp_path != file.temp_path; 
                });

                // //console.log("BEFORE", vm.plane_documents);

                vm.plane_documents.push(file);

                // //console.log("AFTER", vm.plane_documents);

             }














        initController();

        function initController() {
           //console.log("check if access is okay");
        }


            var warning_msg = "By deleting this plane, you will also cancel all reservations that this plane currently has."

          $scope.open = function (plane_id) {
            var modalInstance = $uibModal.open({
              animation: true,
              templateUrl: 'views/modals/deleteModal.html',
              controller: 'ModalInstanceCtrl',
              size: "lg",
              resolve: {
                id: function () {
                  return plane_id;
                },
                params: function() {
                  return {id: plane_id};
                },
                warning: function(){
                    return warning_msg;
                }
              }
            });
            modalInstance.result.then(function (plane_id) {
              $log.info('PRESSED GO: '+plane_id.id);
              ItemService.Delete(vm.user.id, plane_id.id)
              .then(function(){
                //console.log("HELLO DELETE");
                //update view?
                 vm.club.items = $.grep(vm.club.items, function(e){ 
                    return e.id != plane_id.id; 
                });
              })
            }, function () {
              $log.info('Modal dismissed at: ' + new Date());
            });
          };

         


    }