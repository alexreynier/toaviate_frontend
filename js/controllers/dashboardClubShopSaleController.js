 app.controller('DashboardClubShopSaleController', DashboardClubShopSaleController);

    DashboardClubShopSaleController.$inject = ['$timeout', '$sce', 'ExperiencesService', 'PaymentService', '$scope', '$rootScope', 'MemberService', 'ClubService', 'ShopItemService', '$state', 'PackageService', 'ExamSalesService', 'ToastService', '$uibModal'];
    function DashboardClubShopSaleController($timeout, $sce, ExperiencesService, PaymentService, $scope, $rootScope,   MemberService, ClubService, ShopItemService, $state, PackageService, ExamSalesService, ToastService, $uibModal) {

          var vm = this;

            $scope.to_refund = 0;
            $scope.reason = "";
            $scope.club_id = $rootScope.globals.currentUser.current_club_admin.id;
            vm.club_id = $scope.club_id;

            $scope.club_settings = {};

            $scope.new_client = {
              first_name: "",
              last_name: "",
              email: ""
            };

            $scope.items = [];
            $scope.item = {
              title: "",
              quantity: 1,
              vat: 0,
              price: 0
            };

            $scope.selected_client;
            $scope.selected_card;

            vm.selected_voucher;


            $scope.members = [];

            $scope.show_direct_debit_details = false;
            vm.custom_item = false;


            var iconBank = '<svg viewBox="0 0 24 24"><path d="M3 10h18M4 10V8l8-5 8 5v2M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M2 20h20" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
            var iconCard = '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" ry="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M2 9h20M6 14h6" stroke="#4f46e5" stroke-width="1.6"/></svg>';
            var iconNew  = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M12 8v8M8 12h8" stroke="#4f46e5" stroke-width="1.6"/></svg>';
            var iconTerm = '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="14" rx="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="8" y="5" width="8" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="9" y="10" width="6" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
            vm.close_pay_now = function(){
               vm.show_pay_now = false;
               vm.show_loading = false;
               // Closing without paying is fine — the exam sold strip keeps a
               // "Take payment" button and re-checks whether the invoice paid.
               if (vm.exams && vm.exams.sold) { vm.examRefreshSoldStatus(); }
            }

              vm.donConfirm = function(methodLabel, paymentIntent){
                // console.log("confirmation is called", methodLabel);
                // console.log("paymentIntent", paymentIntent);
              //alert('Parent received D confirmation: ' + methodLabel);
                vm.complete_now(methodLabel, paymentIntent);
              };

              vm.default_payment = 'new-card';

              vm.methods = [
                { id: 'direct-debit', title: 'Direct Debit', subtitle: 'Use your BACS mandate', type: 'direct-debit', iconSvg: $sce.trustAsHtml(iconBank), visible: true },
                { id: 'saved-card',   title: 'Saved card',   subtitle: 'Use a card on file',    type: 'saved-card',  iconSvg: $sce.trustAsHtml(iconCard), visible: true },
                { id: 'new-card',     title: 'New card',     subtitle: 'Add a new debit/credit card', type: 'new-card', iconSvg: $sce.trustAsHtml(iconNew), visible: true },
                { id: 'card-machine', title: 'Card Machine', subtitle: 'Pay in person',          type: 'card-machine', iconSvg: $sce.trustAsHtml(iconTerm), visible: true }
              ];

               vm.savedCards = [];



             ShopItemService.GetByClubId(vm.club_id)
                    .then(function(data){
                        vm.shop_items = data.items;   
                    });

            ClubService.GetById($scope.club_id)
            .then(function(data){
                $scope.club_settings = data;
                $scope.item.vat = parseFloat($scope.club_settings.vat_rate);                            
                $scope.club_settings.vat_registered = ($scope.club_settings.vat_registered == 1)? true : false;
                // //console.log("settings", $scope.club_settings);
            });

           ExperiencesService.GetByClubId($scope.club_id)
                  .then(function(data){
                      //console.log("planes", data);
                      vm.vouchers = data.items;
                  });
            ExperiencesService.GetDiscountsByClubId($scope.club_id)
                .then(function(data){
                    //console.log("discounts", data);
                    vm.discounts = data.items;
                });


            PackageService.GetPackagesByClubId($scope.club_id)
            .then(function(data){
                vm.packages = data.items;

                // //console.log("PACKPACK", vm.packages);
            });

            MemberService.GetAllByClub($scope.club_id)
                    .then(function(data){
                        $scope.members = data;   
                        $scope.members.unshift({id: -12, first_name: "New", last_name: "Client"});
                        $scope._initialMembers = $scope.members.slice();
                        // //console.log("members",$scope.members);
                    });

            /**
             * Server-side member search for the shop ui-select.
             * Fires when the user types in the member dropdown and the
             * local filter produces no matches.
             */
            $scope.refreshShopMembers = function(search) {
                if (!search || search.length < 2) {
                    if ($scope._initialMembers && $scope._initialMembers.length) {
                        $scope.members = $scope._initialMembers.slice();
                    }
                    return;
                }

                MemberService.GetAllByClubAndName($scope.club_id, search)
                    .then(function(data) {
                        if (data.success && data.members) {
                            // Keep the "New Client" sentinel and merge server results
                            var existing = $scope.members || [];
                            var merged = existing.slice();
                            var ids = {};
                            for (var i = 0; i < merged.length; i++) {
                                ids[merged[i].user_id || merged[i].id] = true;
                            }
                            for (var j = 0; j < data.members.length; j++) {
                                var row = data.members[j];
                                // Server search rows carry users.id as `id` and no
                                // `user_id` — normalise so flows that need
                                // student.user_id (exam sales, GetMandate) work
                                // for searched members too.
                                if (row.is_member && !(row.user_id > 0)) {
                                    row.user_id = row.id;
                                }
                                var key = row.user_id || row.id;
                                if (!ids[key]) {
                                    merged.push(row);
                                }
                            }
                            $scope.members = merged;
                        }
                    });
            };


            $scope.delete_receipt = function(number){

                
              $scope.items.splice(number, 1);
           
              calculate_charges();

            }

            $scope.card_selected = function(data){
              $scope.selected_card = data;

              if(data.id == -12){
                //  setTimeout(function(){
                //   setupStripe();
                // }, 1000);
              }

            }

            $scope.member_selected = function(data){
              //console.log("selected", data);
              
              $scope.selected_client = data;

              if(data && data.account_ending && data.account_ending !== ''){
                  $scope.show_direct_debit_details = true;
                } else {
                  $scope.show_direct_debit_details = false;
                  //  setTimeout(function(){
                  //   setupStripe();
                  // }, 1000);


                }

              if(data && data.id == -12){
                
                // setTimeout(function(){
                //   setupStripe();
                // }, 1000);

              } 
            }

            $scope.selected_item;

            $scope.item_selected = function(item){
              // //console.log(item);
              $scope.selected_item = item;
            }

            $scope.package_selected = function(item){
              // //console.log(item);
              $scope.selected_package = item;
            }


                vm.new_item_qty = 1;

            vm.add_selected_voucher = function(){

              if($scope.items.find(x => x.voucher_id === vm.selected_voucher.id) && vm.selected_voucher.id > 0){

                  // //console.log("already exists");
                  $scope.items.find(x => x.voucher_id === vm.selected_voucher.id).quantity = $scope.items.find(x => x.voucher_id === vm.selected_voucher.id).quantity + 1;

                } else {
                  if(vm.selected_voucher.id > 0){
                    var add_me = vm.selected_voucher;
                    add_me.quantity = 1;
                    add_me.item_id = vm.selected_voucher.id;
                    
                    add_me.unit_price = vm.selected_voucher.price;

                    add_me.voucher_id = vm.selected_voucher.id;
                    if(vm.selected_discount && vm.selected_discount.id && vm.selected_discount.id > 0){
                      add_me.discount_id = vm.selected_discount.id;
                    } else {
                      add_me.discount_id = 0;
                    }

                    if(add_me.vat_rate){
                      add_me.vat = parseFloat(vm.selected_voucher.vat_rate);
                      delete(add_me.vat_rate);
                    }
                    $scope.items.push(add_me);
                  }
                   
                }


                // //console.log("OBJ TO SEND: ", $scope.item);

               
                $scope.item = {
                            quantity: 1,
                            price: 0,
                            vat: parseFloat($scope.club_settings.vat_rate),
                            title: ""
                          };
                
                vm.new_item_qty = 1;

                calculate_charges();

                ExperiencesService.GetDiscountsByClubIdAndExperienceId($scope.club_id, vm.selected_voucher.id)
                .then(function(data){
                    ////console.log("discounts", data);
                    vm.discounts = data.items;
                });

            }

            vm.add_selected_discount = function(){

                var new_price = 0;

                if(vm.selected_discount.discount_type == 1){
                    //fixed price
                    new_price = vm.selected_discount.discount.price;
                } else {
                    //percentage...
                    new_price = vm.selected_voucher.price - (vm.selected_voucher.price * (vm.selected_discount.percentage / 100) );

                }


                if($scope.items.find(x => x.voucher_id === vm.selected_voucher.id) && vm.selected_voucher.id > 0){

                  // //console.log("already exists");
                  $scope.items.find(x => x.voucher_id === vm.selected_voucher.id).price = new_price;
                  $scope.items.find(x => x.voucher_id === vm.selected_voucher.id).unit_price = new_price;
                  $scope.items.find(x => x.voucher_id === vm.selected_voucher.id).discount_id = vm.selected_discount.id;
                  $scope.items.find(x => x.voucher_id === vm.selected_voucher.id).discount_code = vm.selected_discount.discount_code;
                  // $scope.items.find(x => x.voucher_id === vm.selected_voucher.id).price = new_price;
                                              // vat: parseFloat($scope.club_settings.vat_rate),


                }
                //$scope.items.push(add_me);


                                calculate_charges();

            }

            $scope.add_selected_item = function(){


                // //console.log("HELLO ADDING", item_sent);
                 // //console.log("HELLO ADDING", $scope.items.find(x => x.id === $scope.selected_item.id));
                

                if($scope.items.find(x => x.item_id === $scope.selected_item.id)){

                  // //console.log("already exists");
                  $scope.items.find(x => x.item_id === $scope.selected_item.id).quantity = $scope.items.find(x => x.item_id === $scope.selected_item.id).quantity + vm.new_item_qty;

                } else {
                    var add_me = $scope.selected_item;
                    add_me.quantity = vm.new_item_qty;
                    add_me.item_id = $scope.selected_item.id;
                    if(add_me.vat_rate){
                      add_me.vat = parseFloat($scope.selected_item.vat_rate);
                      delete(add_me.vat_rate);
                    }
                    $scope.items.push(add_me);

                }



                // //console.log("OBJ TO SEND: ", $scope.item);

               
                $scope.item = {
                            quantity: 1,
                            price: 0,
                            vat: parseFloat($scope.club_settings.vat_rate),
                            title: ""
                          };
                
                vm.new_item_qty = 1;

                calculate_charges();

            }


            $scope.selected_package;             


            $scope.add_selected_package = function(){


                // //console.log("HELLO ADDING", item_sent);
                

                if($scope.items.find(x => x.package_id === $scope.selected_package.id)){

                  //console.log("already exists");
                  $scope.items.find(x => x.package_id === $scope.selected_package.id).quantity++;

                } else {
                    var add_me = $scope.selected_package;
                    add_me.quantity = 1;
                    add_me.package_id = $scope.selected_package.id;
                    add_me.vat_rate = parseFloat($scope.club_settings.vat_rate)
                    if(add_me.vat_rate){
                      add_me.package_id = $scope.selected_package.id;
                      add_me.vat = $scope.selected_package.vat_rate;
                      delete(add_me.vat_rate);
                    }
                    $scope.items.push(add_me);

                }



                // //console.log("OBJ TO SEND: ", $scope.item);

               
                $scope.item = {
                            quantity: 1,
                            price: 0,
                            vat: parseFloat($scope.club_settings.vat_rate),
                            title: ""
                          };
                
                vm.new_item_qty = 1;

                calculate_charges();
            }

            


            $scope.add_item = function(item_sent){
                $scope.item = item_sent;

                // //console.log("HELLO ADDING", item_sent);
                // //console.log("HELLO ADDING", $scope.items);

                $scope.items.push($scope.item);

                // //console.log("OBJ TO SEND: ", $scope.item);

               
                $scope.item = {
                            quantity: 1,
                            price: 0,
                            vat: parseFloat($scope.club_settings.vat_rate),
                            title: ""
                          };

                calculate_charges();

            }


            function calculate_charges(){


              // //console.log("Calculate everything now...");
              var total = 0;
              var the_vat = 0;
              for(var i=0; i < $scope.items.length; i++){

                $scope.items[i].total = ($scope.items[i].quantity * $scope.items[i].price);
                if($scope.items[i].vat > 0){
                  this_vat = ( $scope.items[i].total * ($scope.items[i].vat / 100) );
                  the_vat = the_vat + this_vat;
                }
                total = total + $scope.items[i].total;

              }

              $scope.the_vat = the_vat;
              $scope.the_total = total;

            }


          // ── Ground exam sales (Exams tab) ──────────────────────────
          // Catalog is per course with effective_price (per-exam override ??
          // course default). Ticking exams builds a running total; the sale
          // POSTs exam_sales (the backend creates the invoice with snapshot
          // lines) and payment is taken through the normal invoice flow.
          // BACKEND_EXAM_SALES_GUIDE.md §5.1.
          vm.is_manager = ($rootScope.globals.currentUser.access.manager || []).indexOf(vm.club_id) > -1 ||
                          ($rootScope.globals.currentUser.access.super_admin || []).length > 0;

          vm.exams = {
              loading: false,
              courses: [],            // catalog: [{course_id, course_title, exams: [...]}]
              selected_course: null,
              student: null,          // who the exams are for — picked in the tab
              members: [],            // member list for the picker (no "New Client" sentinel)
              ticked: {},             // exam_id → true
              selling: false,
              sold: null,             // last successful sale (confirmation strip)
              pending: [],            // outstanding results (quick entry from the shop)
              pending_loading: false
          };

          // The exams student picker rides the shop's member list (and its
          // server-side search) but never offers "New Client" — exams can
          // only be sold to a current member.
          $scope.$watchCollection('members', function(members){
              vm.exams.members = (members || []).filter(function(m){ return m.id != -12; });
          });

          // Selecting the student here also drives the Payment section below,
          // so the invoice + payment flow stays one continuous story.
          vm.examStudentSelected = function(client){
              vm.exams.student = client;
              $scope.selected_client = client;
              $scope.member_selected(client);
          };

          vm.examsLoad = function(){
              vm.exams.loading = true;
              ExamSalesService.GetCatalog(vm.club_id).then(function(data){
                  vm.exams.loading = false;
                  vm.exams.courses = (data && data.courses) || [];
                  if (vm.exams.courses.length === 1) { vm.exams.selected_course = vm.exams.courses[0]; }
              });
              vm.exams.pending_loading = true;
              ExamSalesService.GetPending(vm.club_id).then(function(data){
                  vm.exams.pending_loading = false;
                  vm.exams.pending = (data && (data.purchases || data.items)) || [];
              });
          };
          vm.examsLoad();

          vm.examSelectCourse = function(course){
              vm.exams.selected_course = course;
              vm.exams.ticked = {};   // ticks are per course — a sale is one course
          };

          vm.examToggle = function(exam){
              if (exam.effective_price === null || exam.effective_price === undefined) { return; }
              vm.exams.ticked[exam.id] = !vm.exams.ticked[exam.id];
          };

          vm.examTickedIds = function(){
              var ids = [];
              var course = vm.exams.selected_course;
              if (!course) { return ids; }
              angular.forEach(course.exams, function(exam){
                  if (vm.exams.ticked[exam.id]) { ids.push(exam.id); }
              });
              return ids;
          };

          vm.examTotal = function(){
              var total = 0;
              var course = vm.exams.selected_course;
              if (!course) { return 0; }
              angular.forEach(course.exams, function(exam){
                  if (vm.exams.ticked[exam.id] && exam.effective_price !== null) {
                      total += parseFloat(exam.effective_price);
                  }
              });
              return total;
          };

          vm.examSell = function(){
              if (vm.exams.selling) { return; }
              var exam_ids = vm.examTickedIds();
              if (!exam_ids.length) {
                  ToastService.warning('Nothing Selected', 'Tick at least one exam to sell.');
                  return;
              }
              var student = vm.exams.student;
              if (!student || !(student.user_id > 0)) {
                  ToastService.warning('Select The Student', 'Exams can only be sold to a current member — choose the student above.');
                  return;
              }
              // Keep the payment section in step even if it was changed there.
              $scope.selected_client = student;
              vm.exams.selling = true;
              vm.exams.sold = null;
              ExamSalesService.Sell({
                  club_id: vm.club_id,
                  course_id: vm.exams.selected_course.course_id,
                  user_id: student.user_id,
                  exam_ids: exam_ids
              }).then(function(data){
                  vm.exams.selling = false;
                  if (data && data.success) {
                      // Enrich each purchase with what the shared result modal
                      // shows in its header — results are enterable from the
                      // sold strip the moment the exam has been sat.
                      var sold_purchases = (data.purchases || []).map(function(p){
                          p.course_title = vm.exams.selected_course.course_title;
                          p.student_first_name = $scope.selected_client.first_name;
                          p.student_last_name = $scope.selected_client.last_name;
                          return p;
                      });
                      vm.exams.sold = {
                          invoice_id: data.invoice_id,
                          total: data.total,
                          purchases: sold_purchases,
                          student: $scope.selected_client.first_name + ' ' + $scope.selected_client.last_name,
                          user_id: $scope.selected_client.user_id,
                          pay_kind: null,        // 'paid' | 'requested' | 'unpaid' | null (unknown)
                          checking: false
                      };
                      vm.exams.ticked = {};
                      vm.examsLoad();
                      ToastService.success('Exams Sold', (data.purchases || []).length + ' exam(s) invoiced to ' + vm.exams.sold.student + ' — take payment now.');
                      open_payment_for_invoice($scope.selected_client.user_id, data.invoice_id);
                  } else {
                      ToastService.error('Not Sold', (data && data.message) || 'The exams could not be sold.');
                  }
              });
          };

          // Re-open the payment window for the last sale — closing it without
          // paying must never strand the invoice.
          vm.examReopenPayment = function(){
              if (!vm.exams.sold) { return; }
              open_payment_for_invoice(vm.exams.sold.user_id, vm.exams.sold.invoice_id);
          };

          // Re-check whether the sold invoice has been paid (the purchase row
          // carries invoice_status once the backend joins it; until then the
          // chip stays unknown and only the Take-payment button shows).
          vm.examRefreshSoldStatus = function(){
              var sold = vm.exams.sold;
              if (!sold || !sold.purchases.length || sold.checking) { return; }
              sold.checking = true;
              ExamSalesService.Get(sold.purchases[0].id).then(function(data){
                  sold.checking = false;
                  var row = (data && (data.purchase || data.item)) || (data && data.id ? data : null);
                  if (row) { sold.pay_kind = ExamSalesService.InvoiceStatusKind(row.invoice_status); }
              });
          };

          vm.examPayKind = function(purchase){
              return ExamSalesService.InvoiceStatusKind(purchase.invoice_status);
          };

          // Enter a result for an outstanding purchase, right from the shop.
          vm.examEnterResult = function(purchase){
              $uibModal.open({
                  templateUrl: 'views/modals/exam_result_modal.html',
                  controller: 'ExamResultModalController',
                  controllerAs: 'vm',
                  backdrop: 'static',
                  resolve: { context: function(){ return { mode: 'enter', purchase: purchase, is_manager: vm.is_manager }; } }
              }).result.then(function(res){
                  if (res && res.saved) {
                      purchase._done = true;   // sold-strip button flips to "recorded"
                      vm.examsLoad();
                  }
              }, function(){});
          };

          vm.examWaitingDays = function(purchase){
              if (!purchase.created_at) { return 0; }
              return moment().diff(moment(String(purchase.created_at).replace(' ', 'T')), 'days');
          };

          // Hand an already-created invoice to the normal payment step
          // (mandate/cards/machine discovery → payment accordion).
          function open_payment_for_invoice(user_id, invoice_id){
              vm.show_loading = true;
              vm.invoice_id = invoice_id;
              vm.send = {
                  club_id: $scope.club_id,
                  user_id: user_id,
                  invoice_id: invoice_id
              };
              MemberService.GetMandate(user_id, $scope.club_id)
                  .then(function (data) {
                      if(data.success){
                          vm.info = data.info;
                          vm.savedCards = data.cards || [];
                          vm.methods[1].visible = vm.savedCards.length > 0;
                          // The member row comes back even when there is no BACS
                          // mandate (all mandate fields null) — only offer Direct
                          // Debit when there is actually a mandate to charge.
                          vm.methods[0].visible = !!(vm.info && vm.info.account_bank);
                          vm.machine = data.machine;
                          vm.methods[3].visible = !!(vm.machine && vm.machine.success);
                          // machine.id set but success false = the club has a
                          // terminal but it isn't online right now.
                          if (vm.machine && !vm.machine.success && vm.machine.id) {
                              ToastService.warning('Card Machine Offline', 'The club card machine is not responding — wake it up and reopen payment to use it.');
                          }
                          vm.show_pay_now = true;
                      }
                      vm.show_loading = false;
                  });
          }

          vm.complete_now = function(method, paymentIntent){
              //user_id
              //club_id
              //invoice_id
              //

              var obj = {
                user_id: $scope.selected_client.user_id,
                club_id: $scope.club_id,
                user: $scope.selected_client,
                invoice_id: vm.invoice_id,
                method: method,
                paymentIntent: paymentIntent
              }

              PaymentService.CompleteCustom(obj)
                .then(function (data) {
                    if(data.success){
                      console.log("complete", data);

                      // Exam sales STAY on the page — the natural next step is
                      // entering the results, offered right in the sold strip
                      // and the awaiting-results list below it.
                      if (vm.exams && vm.exams.sold && vm.exams.sold.invoice_id == vm.invoice_id) {
                          vm.show_pay_now = false;
                          vm.show_loading = false;
                          vm.exams.sold.pay_kind = 'paid';
                          ToastService.success('Payment Complete', 'Invoice #' + vm.invoice_id + ' paid — enter each result below once the exam has been sat.');
                          vm.examsLoad();
                          return;
                      }

                      // Ordinary shop sale — original behaviour.
                      $timeout(function() {
                        $state.go('dashboard.manage_club', {}, { reload: true });
                      }, 2000); // delay in milliseconds (2 seconds here)

                    }
              });

          }
           
          vm.invoice_id = 0;

          $scope.ok = function () {


            //guessing this is where it would all be happening 14/11/2025

            //all we need to do is call the payment with "amount"
            //then we add the payment_id to the request below --> unless this is Direct Debit for existing client

            //some nice ideas about what to offer admins to be able to enter



            vm.show_loading = true;

            // obj.reason = $scope.reason;
            // obj.to_refund = $scope.to_refund


            //let's create all that is required to issue the invoice.
            if($scope.selected_client.id == -12){


              $scope.selected_client.first_name = $scope.new_client.first_name;
              $scope.selected_client.last_name = $scope.new_client.last_name;
              $scope.selected_client.email = $scope.new_client.email;

            } else{

               $scope.selected_client.first_name = $scope.selected_client.first_name;
               $scope.selected_client.last_name = $scope.selected_client.last_name;
               $scope.selected_client.email = $scope.selected_client.email;
            
            }


            var obj_to_send = {
                items: $scope.items,
                user: $scope.selected_client,
                user_id: $scope.selected_client.user_id,
                club_id: $scope.club_id
              };


              // SAMPLE OF WHERE WE NEED TO SEND THE SHIZZLE....
              PaymentService.CreateCustom(obj_to_send)
              .then(function (data) {
                  if(data.success){
                    //alert("Invoice successfully created!");
                      ////console.log("CARD: "+data);
                      //fill the drop down menu

                      //show payment now
                      vm.invoice_id = data.invoice_id;
                      //set payment bits here woo
                        vm.send = {
                            club_id: data.club_id,
                            user_id: data.user_id,
                            invoice_id: data.invoice_id
                        }
                        //console.log(vm.send);
                        
                        //get user cards
                        //get user info

                        MemberService.GetMandate(data.user_id, data.club_id)
                                .then(function (data) {
                                       // console.log("data is : ", data);
                                         //return false;
                                if(data.success){
                                    vm.info = data.info;

                                    vm.savedCards = data.cards || [];

                                    if(vm.savedCards.length > 0){
                                        vm.methods[1].visible = true;
                                    } else {
                                        vm.methods[1].visible = false;
                                    }

                                    // The member row comes back even when there is
                                    // no BACS mandate (all mandate fields null) —
                                    // only offer Direct Debit when there is
                                    // actually a mandate to charge.
                                    vm.methods[0].visible = !!(vm.info && vm.info.account_bank);

                                    vm.machine = data.machine;
                                    if(vm.machine && vm.machine.success){
                                        vm.methods[3].visible = true;
                                    } else {
                                        vm.methods[3].visible = false;
                                        // machine.id set but success false = the club
                                        // has a terminal but it isn't online right now.
                                        if (vm.machine && vm.machine.id) {
                                            ToastService.warning('Card Machine Offline', 'The club card machine is not responding — wake it up and reopen payment to use it.');
                                        }
                                    }

                                    vm.show_pay_now = true;
                                    vm.show_loading = false;
                                }

                            });

                       

                    



                      //vm.show_loading = false;
                  } else {
                      //console.log("WOOOPSIES...", data);
                      //this should be very very rare...
                      vm.show_loading = false;

                  }

              });







            // if($scope.selected_client.id == -12 || !$scope.show_direct_debit_details){
            //   //if there is a custom card entered - then we continue here...
            //   var obj_to_send = {
            //     payment: card_obj,
            //     items: $scope.items,
            //     user: $scope.selected_client,
            //     club_id: $scope.club_id
            //   };


            //   // SAMPLE OF WHERE WE NEED TO SEND THE SHIZZLE....
            //   PaymentService.CreateCustom(obj_to_send)
            //   .then(function (data) {
            //       if(data.success){
            //         alert("Invoice successfully created & payment made!");
            //           ////console.log("CARD: "+data);
            //           //fill the drop down menu
            //           $state.go('dashboard.manage_club', {}, { reload: true });
            //            vm.show_loading = false;
            //       } else {
            //           //console.log("WOOOPSIES...", data);
            //           //this should be very very rare...
            //            vm.show_loading = false;

            //       }

            //   });


            //   var options = {};
            //   // stripe.createToken(card, options).then(function(result) {
            //   //   if (result.error) {
            //   //     // Inform the user if there was an error
            //   //     var errorElement = document.getElementById('card-errors');
            //   //     errorElement.textContent = result.error.message;
            //   //   } else {

            //   //     //stripeTokenHandler(result.token);
            //   //     ////console.log("RESULT", result);

            //   //     if(result.token.id){
            //   //       ////console.log("STUFF", result.token.id);

            //   //       //prepare a basic object...
            //   //       var card_obj = {
            //   //           brand: result.token.card.brand,
            //   //           last4: result.token.card.last4,
            //   //           hash: result.token.card.id,
            //   //           token: result.token.id,
            //   //           funding: result.token.card.funding,
            //   //           name: result.token.card.name,
            //   //           client_ip: result.token.client_ip
            //   //       };


            //   //       var obj_to_send = {
            //   //         payment: card_obj,
            //   //         items: $scope.items,
            //   //         user: $scope.selected_client,
            //   //         club_id: $scope.club_id
            //   //       };


            //   //       // SAMPLE OF WHERE WE NEED TO SEND THE SHIZZLE....
            //   //       PaymentService.CreateCustom(obj_to_send)
            //   //       .then(function (data) {
            //   //           if(data.success){
            //   //             alert("Invoice successfully created & payment made!");
            //   //               ////console.log("CARD: "+data);
            //   //               //fill the drop down menu
            //   //               $state.go('dashboard.manage_club', {}, { reload: true });
            //   //                vm.show_loading = false;
            //   //           } else {
            //   //               //console.log("WOOOPSIES...", data);
            //   //               //this should be very very rare...
            //   //                vm.show_loading = false;

            //   //           }

            //   //       });
                    


            //   //     }

            //   //   }
            //   // });

            // } else {

            //   //this should now be when we charge a saved card.

            //   //create a new charge request? is that server side?


            //   // var obj_to_send = {
            //   //     payment: {},
            //   //     items: $scope.items,
            //   //     user: $scope.selected_client,
            //   //     club_id: $scope.club_id
            //   //   };

            //   //   if($scope.selected_client.account_ending !== ""){
            //   //     obj_to_send.payment.direct_debit = true;
            //   //     obj_to_send.payment.pay_now = vm.direct_debit_pay_now;
            //   //   }


            //   // PaymentService.CreateCustom(obj_to_send)
            //   //       .then(function (data) {
            //   //           if(data.success){
            //   //               alert("Invoice successfully created!");

            //   //               //$state.go('dashboard.my_account.payment_methods', {}, { reload: true });
            //   //               $state.go('dashboard.manage_club', {}, { reload: true });
            //   //           } else {
            //   //               //console.log("WOOOPSIES...", data);
            //   //               //this should be very very rare...

            //   //           }
            //   //       });


            //   var obj_to_send = {
            //     payment: card_obj,
            //     items: $scope.items,
            //     user: $scope.selected_client,
            //     club_id: $scope.club_id
            //   };


            //   // SAMPLE OF WHERE WE NEED TO SEND THE SHIZZLE....
            //   PaymentService.CreateCustom(obj_to_send)
            //   .then(function (data) {
            //       if(data.success){
            //         alert("Invoice successfully created & payment made!");
            //           ////console.log("CARD: "+data);
            //           //fill the drop down menu
            //           $state.go('dashboard.manage_club', {}, { reload: true });
            //            vm.show_loading = false;
            //       } else {
            //           //console.log("WOOOPSIES...", data);
            //           //this should be very very rare...
            //            vm.show_loading = false;

            //       }

            //   });







            //   //then we don't need a stripe token...

            //    // SAMPLE OF WHERE WE NEED TO SEND THE SHIZZLE....
            //   // PaymentService.Create(obj)
            //   // .then(function (data) {
            //   //     if(data.success){

            //   //         //console.log("CARD: "+data);
            //   //         //fill the drop down menu
            //   //         $state.go('dashboard.my_account.payment_methods', {}, { reload: true });
            //     //            $uibModalInstance.close(obj);

            //   //     } else {
            //   //         //console.log("WOOOPSIES...", data);
            //   //         //this should be very very rare...

            //   //     }
            //   // });





            // }
            




          };

          $scope.cancel = function () {

                            $state.go('dashboard.manage_club', {}, { reload: true });

          };

         








          //STRIPE STUFF HERE PLEASE!!! :-)


        // var stripe = Stripe('pk_test_Ers4ZfdIMZ59ac4wKy6FDAH2');
        // var elements = stripe.elements();

        // var card_options = {
        //       hidePostalCode: true,
        //       style: {
        //         base: {
        //           iconColor: '#666EE8',
        //           color: '#31325F',
        //           lineHeight: '40px',
        //           fontWeight: 300,
        //           fontFamily: 'Helvetica Neue',
        //           fontSize: '15px',
        //           '::placeholder': {
        //             color: '#CFD7E0',
        //           },
        //         },
        //       }
        //     };

        // var card = elements.create('card', card_options);

        // var run = false;
        // var timeout;

        // function setupStripe(){
        //     clearTimeout(timeout);
        //     if(run == false){
        //         run = true;

        //         card.mount('#card-element');
            
        //         form = document.getElementById('payment-form');
        //         form.addEventListener('submit', function(e) {
        //           e.preventDefault();
        //           createToken();
        //         });
        //     } 
        // }   


        // // $scope.$on('$viewContentLoaded', function(){
        // //         clearTimeout(timeout);
        // //         if(run2 == false){
        // //             run2 = true;
        // //             timeout = setTimeout(function(){ setupStripe(); }, 1500); 
        // //         }
        // // });

     

        // function stripeTokenHandler(token) {
        //   // Insert the token ID into the form so it gets submitted to the server
        //   var form = document.getElementById('payment-form');
        //   var hiddenInput = document.createElement('input');
        //   hiddenInput.setAttribute('type', 'hidden');
        //   hiddenInput.setAttribute('name', 'stripeToken');
        //   hiddenInput.setAttribute('value', token.id);
        //   form.appendChild(hiddenInput);

        //   // Submit the form
        //   ////console.log("TOKEN", token);
        //   //form.submit();
        // }

        // function create_invoice() {
        //   ////console.log("HELLO CREATE TOKEN? 1");
        //    var options = {
        //     // name: document.getElementById('name').value,
        //     //  address_line1: document.getElementById('address-line1').value,
        //     // address_line2: document.getElementById('address-line2').value,
        //     // address_city: document.getElementById('address-city').value,
        //     // address_zip: document.getElementById('address-postcode').value,
        //     // address_country: document.getElementById('address-country').value,
        //   };

        //   stripe.createToken(card, options).then(function(result) {
        //     if (result.error) {
        //       // Inform the user if there was an error
        //       var errorElement = document.getElementById('card-errors');
        //       errorElement.textContent = result.error.message;
        //     } else {
        //       // Send the token to your server
        //       //stripeTokenHandler(result.token);
        //       ////console.log("RESULT", result);

        //       if(result.token.id){
        //       ////console.log("STUFF", result.token.id);

        //         //prepare a basic object...
        //         var obj = {
        //             user_id: vm.user.id,
        //             brand: result.token.card.brand,
        //             last4: result.token.card.last4,
        //             hash: result.token.card.id,
        //             token: result.token.id,
        //             funding: result.token.card.funding,
        //             name: result.token.card.name,
        //             client_ip: result.token.client_ip
        //         };


        //         PaymentService.Create(obj)
        //         .then(function (data) {
        //             if(data.success){

        //                 //console.log("CARD: "+data);
        //                 //fill the drop down menu
        //                 alert("success creating invoice");
        //                 //$state.go('dashboard.my_account.payment_methods', {}, { reload: true });

        //             } else {
        //                 //console.log("WOOOPSIES...", data);
        //                 //this should be very very rare...

        //             }
        //         });



        //       }

        //     }
        //   });
        // };







    }