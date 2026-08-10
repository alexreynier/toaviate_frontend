 app.controller('AircraftStatusController', AircraftStatusController);

    AircraftStatusController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'BookingService', 'LicenceService', 'ClubDocumentService', 'PlaneDocumentService', '$http', 'PlaneService', 'ToastService', 'DefectMediaService', 'AircraftChecksService', '$filter', '$q'];
    function AircraftStatusController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, BookingService, LicenceService, ClubDocumentService, PlaneDocumentService, $http, PlaneService, ToastService, DefectMediaService, AircraftChecksService, $filter, $q) {
        
        var vm = this;

        vm.clubs = [];
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;


        vm.looking_for = $stateParams.registration;
        if(vm.looking_for){
            $scope.my_search2 = vm.looking_for;
        }


        vm.defect_severity;
        vm.defect_severities = [
            { title: "No Fly Item - Ground the plane"},
            { title: "Flyable - needs to be checked at next maintenance"},
            { title: "Not urgent - but needs noting"},
            { title: "Unsure of severity"}
        ]; 


        // ── Defect report panel state ──
        vm.showDefectPanel = false;
        vm.defectPanelRegistration = '';
        vm._defectPanelPlaneId = null;
        vm._defectPanelClubId = null;

        vm.openDefectPanel = function (planeId, registration, clubId) {
            vm._defectPanelPlaneId = planeId;
            vm._defectPanelClubId = clubId;
            vm.defectPanelRegistration = registration;
            vm.showDefectPanel = true;
        };

        vm.closeDefectPanel = function () {
            vm.showDefectPanel = false;
        };

        vm.submitDefect = function (defectData, pendingFiles) {
            var obj = {
                club_id:  vm._defectPanelClubId,
                user_id:  vm.user_id,
                plane_id: vm._defectPanelPlaneId,
                defect:   defectData.defect,
                severity: defectData.severity,
                status:   'open'
            };

            PlaneService.AddDefect(obj)
                .then(function (data) {
                    data.item.can_delete = true;
                    var club = vm.clubs.find(function (c) { return c.id === vm._defectPanelClubId; });
                    if (club) {
                        var plane = club.planes.find(function (p) { return p.plane_id === vm._defectPanelPlaneId; });
                        if (plane) plane.defects.push(data.item);
                    }
                    ToastService.success('Defect Reported', 'The defect has been submitted.');

                    // Upload any attached media files
                    if (pendingFiles && pendingFiles.length > 0) {
                        pendingFiles.forEach(function (file, idx) {
                            DefectMediaService.UploadAndAttach(file, data.item.id, vm._defectPanelClubId, idx, vm.user_id)
                                .then(function (mediaResult) {
                                    if (mediaResult && mediaResult.success) {
                                        data.item.media_count = (data.item.media_count || 0) + 1;
                                    }
                                });
                        });
                    }

                    vm.showDefectPanel = false;
                    vm.defect = '';
                    vm.defect_severity = '';
                });
        };


        ////console.log("REG: "+$stateParams.registration);


         // The maintenance fetch is one big call (every club, plane, defect and
         // check) — show the loading state until it lands, then reveal.
         vm.loading = true;

         PlaneService.GetByUserMaintenance(vm.user.id)
            .then(function (data) {
                    ////console.log("data is : ", data);
                   vm.loading = false;
                   vm.clubs = data.clubs;

                   // Let the entrance cascade play once, then drop the
                   // animation classes so search filtering re-renders
                   // instantly instead of replaying the stagger delays.
                   $timeout(function () { vm.reveal_done = true; }, 1600);

                   // Today's aircraft checks per plane.
                   // PREFERRED: the main maintenance response embeds today's checks
                   // on each plane (plane.aircraft_checks / plane.checks_today), so we
                   // don't fire one /aircraft_checks/plane/{id}/{date} call per aircraft
                   // (that produced dozens of requests on load).
                   // FALLBACK: if the field isn't present yet, fetch per plane as before
                   // so the page keeps working until the backend embeds them.
                   var todayStr = new Date().toISOString().slice(0, 10);
                   if (vm.clubs && vm.clubs.length > 0) {
                       vm.clubs.forEach(function(club) {
                           if (club.planes && club.planes.length > 0) {
                               club.planes.forEach(function(plane) {
                                   plane._checks_show_all = false;

                                   var embedded = plane.aircraft_checks || plane.checks_today;
                                   if (angular.isArray(embedded)) {
                                       // Checks came back with the main call — no extra request.
                                       plane._aircraft_checks = embedded;
                                       plane._checks_loading = false;
                                   } else {
                                       // Backend hasn't embedded them yet — fetch per plane.
                                       plane._checks_loading = true;
                                       plane._aircraft_checks = [];
                                       AircraftChecksService.GetChecksByPlaneDate(plane.plane_id, todayStr)
                                           .then(function(checkData) {
                                               plane._checks_loading = false;
                                               if (checkData.success) {
                                                   plane._aircraft_checks = checkData.checks || [];
                                               }
                                           })
                                           .catch(function() {
                                               plane._checks_loading = false;
                                           });
                                   }
                               });
                           }
                       });
                   }

                });


            vm.loadAllChecks = function(plane) {
                plane._checks_loading = true;
                plane._checks_show_all = true;
                AircraftChecksService.GetChecksByPlane(plane.plane_id)
                    .then(function(checkData) {
                        plane._checks_loading = false;
                        if (checkData.success) {
                            plane._aircraft_checks = checkData.checks || [];
                        }
                    })
                    .catch(function() {
                        plane._checks_loading = false;
                    });
            };

            // ════════════════════════════════════════════════════════════
            // Standalone fuel/oil uplift + A-check (outside a flight)
            // ════════════════════════════════════════════════════════════

            vm.currenciesByClub = {};   // club_id -> [currency]
            vm.checkTypesByClub = {};   // club_id -> [check type]

            // ── Fuel / oil uplift panel ──
            vm.showFuelPanel = false;
            vm._fuelPlane = null;
            vm._fuelClubId = null;

            vm.openFuelPanel = function(plane, club) {
                vm._fuelPlane = plane;
                vm._fuelClubId = club.id;
                if (!vm.currenciesByClub[club.id]) {
                    PlaneService.GetCurrencies(club.id).then(function(data) {
                        vm.currenciesByClub[club.id] = (data && data.currencies) ? data.currencies : [];
                    });
                }
                vm.showFuelPanel = true;
            };
            vm.closeFuelPanel = function() { vm.showFuelPanel = false; };

            vm.submitFuelUplift = function(receiptData, pendingFile) {
                var plane = vm._fuelPlane;
                var clubId = vm._fuelClubId;

                // Upload the receipt image first (if supplied), then save the receipt.
                uploadReceiptImage(pendingFile).then(function(imagePath) {
                    var obj = {
                        plane_id: plane.plane_id,
                        club_id: clubId,
                        user_id: vm.user_id,
                        plane_log_sheet_id: null,      // standalone — not tied to a flight
                        reimbursement: receiptData.reimbursement,
                        image: imagePath || '',
                        currency: receiptData.currency ? receiptData.currency.iso_code : '',
                        item: receiptData.item,
                        quantity: receiptData.quantity,
                        price: receiptData.price
                    };

                    PlaneService.AddReceipt(obj).then(function(rcpt) {
                        if (rcpt && rcpt.item) {
                            if (!plane.receipts) { plane.receipts = []; }
                            plane.receipts.unshift(rcpt.item);
                            ToastService.success('Uplift Recorded', receiptData.item + ' uplift saved for ' + plane.registration + '.');
                            vm.showFuelPanel = false;
                        } else {
                            ToastService.error('Save Failed', (rcpt && rcpt.message) || 'The uplift could not be saved.');
                            // leave panel open so the user can retry
                            $scope.$broadcast('fuelPanelReset');
                        }
                    });
                }, function() {
                    ToastService.error('Upload Failed', 'The receipt image could not be uploaded. Please try again.');
                });
            };

            // Upload a single image File to the generic upload endpoint and resolve
            // its saved path (same shape the booking flow's processFiles reads:
            // response JSON -> saved_url). Resolves '' when there's no file.
            function uploadReceiptImage(file) {
                if (!file) { return $q.when(''); }
                var fd = new FormData();
                fd.append('file', file);
                return $http.post($rootScope.uploadUrl, fd, {
                    transformRequest: angular.identity,
                    headers: { 'Content-Type': undefined }
                }).then(function(res) {
                    var data = res.data;
                    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) {} }
                    return (data && (data.saved_url || data.temp_path)) || '';
                });
            }

            // ── Aircraft check (Check A / daily) panel ──
            vm.showCheckPanel = false;
            vm._checkPlane = null;
            vm._checkClubId = null;

            // The panel is fed with:
            //   vm.checkOfferedType   — the mandatory type to complete (role-matched
            //                           from the /required response), or null.
            //   vm.checkCustomTypes   — the club's role:'custom' types ("Add another check").
            vm.checkOfferedType = null;
            vm.checkCustomTypes = [];

            // Find the club's active type for a given role (a_check / transit).
            function typeForRole(clubId, role) {
                var list = vm.checkTypesByClub[clubId] || [];
                for (var i = 0; i < list.length; i++) {
                    if (list[i].role === role) { return list[i]; }
                }
                return null;
            }

            // The "other checks" list = every active type EXCEPT the one being offered
            // as the mandatory check. We intentionally do NOT filter on role === 'custom'
            // here, because a club's types may have no role assigned yet — filtering
            // strictly on 'custom' would hide them and leave nothing selectable.
            function setSelectableTypes(clubId, offeredType) {
                var list = vm.checkTypesByClub[clubId] || [];
                var offeredId = offeredType ? offeredType.id : null;
                vm.checkCustomTypes = list.filter(function(t) { return t.id !== offeredId; });
            }

            // Decide which mandatory type to offer from the /required response:
            //   check_type 'check_a'       -> the role:'a_check' type
            //   check_type 'transit_check' -> the role:'transit' type (an A already done today)
            //   not required               -> no mandatory offer (custom only)
            function resolveOfferedType(clubId, requiredData) {
                if (!requiredData || !requiredData.required) { return null; }
                if (requiredData.check_type === 'check_a')       { return typeForRole(clubId, 'a_check'); }
                if (requiredData.check_type === 'transit_check') { return typeForRole(clubId, 'transit'); }
                return null;
            }

            vm.openCheckPanel = function(plane, club) {
                vm._checkPlane = plane;
                vm._checkClubId = club.id;
                vm.checkOfferedType = null;
                vm.checkCustomTypes = [];

                var todayStr = new Date().toISOString().slice(0, 10);

                function applyTypes(offeredType) {
                    vm.checkOfferedType = offeredType;
                    setSelectableTypes(club.id, offeredType);
                }

                // Load the club's active types (with roles), then ask what's required
                // today and resolve the mandatory type by role. If the requirement
                // can't be resolved to a role-matched type (e.g. roles not assigned),
                // fall back so the panel is still usable: offer nothing mandatory but
                // list ALL active types to choose from.
                function afterTypesLoaded() {
                    AircraftChecksService.GetRequiredCheck(plane.plane_id, todayStr)
                        .then(function(reqData) {
                            applyTypes(resolveOfferedType(club.id, reqData));
                        })
                        .catch(function() { applyTypes(null); });
                }

                if (!vm.checkTypesByClub[club.id]) {
                    AircraftChecksService.GetActiveCheckTypes(club.id).then(function(data) {
                        vm.checkTypesByClub[club.id] = (data && data.check_types) ? data.check_types : [];
                        afterTypesLoaded();
                    });
                } else {
                    afterTypesLoaded();
                }

                vm.showCheckPanel = true;
            };
            vm.closeCheckPanel = function() { vm.showCheckPanel = false; };

            vm.submitAircraftCheck = function(checkData) {
                var plane = vm._checkPlane;
                var clubId = vm._checkClubId;
                var flight_date = $filter('date')(checkData.checked_at, 'yyyy-MM-dd');

                var obj = {
                    club_id: clubId,
                    plane_id: plane.plane_id,
                    booking_id: null,              // standalone — not tied to a flight
                    check_type: checkData.check_type,          // the type's code
                    check_type_id: checkData.check_type_id,    // the type's id (role-based model)
                    performed_by: vm.user_id,
                    checked_at: checkData.checked_at,
                    fuel_us_gallons: checkData.fuel_us_gallons,
                    oil_quarts: checkData.oil_quarts,
                    flight_date: flight_date,
                    notes: checkData.notes || ''
                };

                AircraftChecksService.CreateCheck(obj).then(function(data) {
                    if (data && data.success) {
                        ToastService.success('Check Submitted', (checkData.check_type_label || 'Check') + ' recorded for ' + plane.registration + '.');
                        vm.showCheckPanel = false;
                        // Refresh this plane's checks so the new one shows immediately.
                        var todayStr = new Date().toISOString().slice(0, 10);
                        plane._checks_loading = true;
                        var refresh = plane._checks_show_all
                            ? AircraftChecksService.GetChecksByPlane(plane.plane_id)
                            : AircraftChecksService.GetChecksByPlaneDate(plane.plane_id, todayStr);
                        refresh.then(function(checkData2) {
                            plane._checks_loading = false;
                            if (checkData2.success) { plane._aircraft_checks = checkData2.checks || []; }
                        }).catch(function() { plane._checks_loading = false; });

                        // Re-check the requirement so the status flips (e.g. after an
                        // A-check, bookout should no longer demand one). If it's now
                        // satisfied, clear the per-plane flag locally.
                        AircraftChecksService.GetRequiredCheck(plane.plane_id, todayStr)
                            .then(function(reqData) {
                                if (reqData && !reqData.required) {
                                    plane.requires_check_a = 0;
                                }
                            });
                    } else {
                        ToastService.error('Check Failed', (data && data.message) || 'The check could not be submitted.');
                        $scope.$broadcast('checkPanelReset');
                    }
                });
            };

            vm.get_initial = function(text){
                return text.charAt(0);
            }

            // Label a check by its (club-defined) name. Role-based model: the club
            // names its own types (e.g. "A Check"), so prefer check_type_name; fall
            // back to a tidied code, then a role word.
            vm.checkTypeLabel = function(check) {
                if (!check) { return ''; }
                if (check.check_type_name) { return check.check_type_name; }
                var code = check.check_type;
                if (code) {
                    return code.replace(/_/g, ' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
                }
                if (check.role === 'a_check') { return 'A Check'; }
                if (check.role === 'transit') { return 'Transit Check'; }
                return 'Check';
            };

            // Colour the badge by ROLE (not code): a_check=green, transit=blue,
            // custom=neutral. Checks carry a `role` field.
            vm.checkBadgeClass = function(check) {
                if (!check) { return 'badge-default'; }
                if (check.role === 'a_check') { return 'badge-success'; }
                if (check.role === 'transit') { return 'badge-info'; }
                return 'badge-default';
            };

            vm.list_pilots = function(row){

            var p1 = "";
            var put = "";

            // if(row.instructor_first_name && row.instructor_first_name !== null){
            //     p1 = "PIC: "+row.instructor_first_name+" "+row.instructor_last_name;
            //     put = "<br />PUT: "+row.first_name+" "+row.last_name;
            // } else {
            //     if(row.first_name && row.first_name !== null){
            //         p1 = "PIC: "+row.first_name+" "+row.last_name;
            //     } else {
            //         p1 = "PIC not yet set!";
            //     }
            // }

            p1 = "PIC: "+ vm.get_pic(row);
            put = vm.get_put(row);
            if(put && put !== ""){
                put = "<br />PUT: " + put;
            }

            if(p1 && p1 == ""){
                p1 = "No PIC set yet!";
            }

            return $sce.getTrustedHtml('<div>'+p1+' '+put+'</div>');

        }

        vm.get_pic = function(log){

            var p1 = "";

            if(log.pic_first_name && log.pic_first_name !== null){
                p1 = vm.get_initial(log.pic_first_name) + ". " + log.pic_last_name;
            } else if(log.instructor_first_name && log.instructor_first_name !== ""){
                p1 = vm.get_initial(log.instructor_first_name) + ". " + log.instructor_last_name;
            } else if(log.instructor_id == 0 && log.first_name && log.first_name !== ""){
                p1 = vm.get_initial(log.first_name) + ". " + log.last_name;
            }

            return p1;

        }

        vm.get_put = function(log){

            var put = "";

            if(log.put_first_name && log.put_first_name !== null){
                put = vm.get_initial(log.put_first_name) + ". " + log.put_last_name;
            } else if(log.instructor_id > 0 && log.first_name && log.first_name !== ""){
                put = vm.get_initial(log.first_name) + ". " + log.last_name;
            } 

            return put;

        }

            
            vm.clean_times = function(time){
                return roundTimeToMinute(time);
            }

            vm.add_defect = function(plane_id, club_id){


                var obj = {
                    club_id: club_id,
                    user_id: vm.user_id,
                    plane_id: plane_id,
                    defect: vm.defect,
                    severity: vm.defect_severity.title,
                    status: "open"
                }



                PlaneService.AddDefect(obj)
                 .then(function (data) {
                        ////console.log("data is : ", data);
                        data.item.can_delete = true;

                        //HELLO
                        vm.clubs.find(club => club.id === club_id).planes.find(plane => plane.plane_id === plane_id).defects.push(data.item);
                        //vm.reported_defects.push(data.item);

                        vm.defect = "";
                        vm.defect_severity = "";



                    });

            }

            vm.delete_defect = function(id){
                // //console.log("UNDO DEFECT ID ", id);

                PlaneService.DeleteDefect(id)
                .then(function (data) {
                        ////console.log("data is : ", data);
                       
                        PlaneService.GetOpenIssues(vm.bookout.plane_id)
                        .then(function (data) {
                                ////console.log("data is : ", data);
                               vm.reported_defects = data;
                            });


                    });

            }


            $scope.filter_detail = function(show_all = 0){
                return (show_all == 0) ? {status: "open"} : {};
            }

            $scope.count_defects = function(defects, show_all = 0){

               var counter = 0;

               for(var i=0;i<defects.length;i++){
                   if(show_all == 1){
                       counter++;
                   } else {
                       if(defects[i].status == "open"){
                           counter++;
                       }
                   }
               }

               return counter;

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


        vm.show_receipt_image = function(receipt){

            vm.show_receipt = true;
            vm.receipt_image = receipt.image;

        }

        vm.get_icon3 = function(file){

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

        // A receipt only has a real image when there's actual content. Standalone
        // uplifts saved without a photo come back as an empty data-URI prefix
        // ("data:image/png;base64,") with nothing after the comma — that must NOT
        // show a clickable icon (it would open a blank preview).
        vm.hasReceiptImage = function(image){
            if (!image) { return false; }
            var idx = image.indexOf('base64,');
            if (idx > -1) {
                // data URI: real only if there's payload after "base64,"
                return image.substring(idx + 7).trim().length > 0;
            }
            // otherwise treat any non-empty string (e.g. a URL/path) as a real image
            return image.trim().length > 0;
        };


        $scope.search = function(row){
            ////console.log("hi", (angular.lowercase(row.title).indexOf(angular.lowercase($scope.my_search) || '') !== -1));
            return (angular.lowercase(row.title).indexOf(angular.lowercase($scope.my_search) || '') !== -1);
        };

        $scope.search2 = function(row){
            return (angular.lowercase(row.registration).indexOf(angular.lowercase($scope.my_search2) || '') !== -1);
        };

        $scope.getMySearchCount = function(str){
            var docs = str.documents;
            var total = 0;
            for(var i=0;i<docs.length;i++){
                if($scope.search(docs[i])){
                    total++;
                }
            }
            return total;
        }

        $scope.getMySearchCount2 = function(str){
            var charges = str.charges;
            var total = 0;
            for(var i=0;i<charges.length;i++){
                if($scope.search(charges[i])){
                    total++;
                }
            }
            return total;
        }

        //  $scope.get_hours_from_decimal = function(time){

        //     if(time){
        //         var n = new Date(0,0);
        //         n.setMinutes(+time * 60);
        //         return n.toTimeString().slice(0,5);
        //     } else {
        //         return "N/A";
        //     }

        // }

        $scope.get_hours_from_decimal = function(time){

            if(time){
                 var sign = time < 0 ? "-" : "";
                 var hour = Math.floor(Math.abs(time));
                 var min = Math.round((Math.abs(time) * 60) % 60);
                 if(min == 60){
                     hour++;
                     min = 0;
                 }
                 return sign + (hour < 10 ? "0" : "") + hour + ":" + (min < 10 ? "0" : "") + min;
             } else {
                 return "N/A";
             }
        }



        $scope.downloadDocument = function(doc, type) {
            var data = $.param({
                id: doc
            });

            //alert("type", type);

            var controller = "plane_documents";

            switch(type){
                 case "radio": 
                    controller = "plane_radio_licence";
                break;
                 case "insurance": 
                    controller = "plane_insurance";
                break;
                 case "certificate": 
                    controller = "plane_certificate";
                break;
                case "noise":
                    controller = "plane_noise_certificate";
                break;
                case "crs":
                    controller = "plane_crs";
                break;
                case "docs":
                    controller = "plane_documents";
                break;
                default:
                    controller = "plane_documents";
                break;
            }

            var ddd = doc.replace(/^.*[\\\/]/, '');

            $http.get('api/v1/'+controller+'/show_file/'+ddd, {
                    responseType: 'arraybuffer'
                })
                .success(function(data, status, headers) {
                    var zipName = processArrayBufferToBlob(data, headers);

                    //Delete file from temp folder in server - file needs to remain open until blob is created
                    //deleteFileFromServerTemp(zipName);
                }).error(function(data, status) {
                    ToastService.error('Download Failed', 'There was an error downloading the selected document(s).');
                })
        };

        $scope.downloadClubDocument = function(doc) {
            var data = $.param({
                id: doc
            });

            var ddd = doc.replace(/^.*[\\\/]/, '');

            $http.get('api/v1/club_documents/show_file/'+ddd, {
                    responseType: 'arraybuffer'
                })
                .success(function(data, status, headers) {
                    var zipName = processArrayBufferToBlob(data, headers);

                    //Delete file from temp folder in server - file needs to remain open until blob is created
                    //deleteFileFromServerTemp(zipName);
                }).error(function(data, status) {
                    ToastService.error('Download Failed', 'There was an error downloading the selected document(s).');
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


        vm.round_brake_times_start = function(input, earlier_input=null){
            
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
                    } else if(min_nearest_five > 60){
                      split[0]++;
                      min_nearest_five = (min_nearest_five - 60);
                    }


                    if(earlier_input && earlier_input.indexOf(":") > -1){
                            // console.log("total calculated?");
                            // console.log("earlier_input: ", earlier_input);
                            // console.log("input: ", input);
                            var esplit = earlier_input.split(":");
                            var ehour = esplit[0];
                            var emin = esplit[1];
                            var etot = (parseInt(ehour)*60) + parseInt(emin); 
                            // console.log("etot: ", etot);
                            var hr = split[0];
                            var mn = min_nearest_five;
                            var tot = (parseInt(hr)*60) + parseInt(mn);
                            // console.log("tot: ", tot);

                            if(etot < tot){
                                //the earlier time is after the end time
                                // console.log("etot < tot");
                                min_nearest_five = parseInt(min_nearest_five) - 5;
                                if(min_nearest_five == 60){
                                    split[0]++; 
                                    min_nearest_five = "00";
                                } else if(min_nearest_five > 60){
                                    split[0]++;
                                    min_nearest_five = (min_nearest_five - 60);
                                    if(min_nearest_five < 10 ){
                                      min_nearest_five = "0"+min_nearest_five;
                                    }
                                } else if(min_nearest_five < 0){
                                    split[0]--;
                                    min_nearest_five = (60 + parseInt(min_nearest_five));
                                }
                                // console.log("split: ", split[0]);
                                // console.log("min_nearest_five: ", min_nearest_five);
                            }

                    }
                    //essentially we add 5 in case something happens over the limit

                    return split[0] + ":" + min_nearest_five;
                  } else {
                    return input;
                  }
                } else {
                  return '';
                }
          

          }

          vm.round_brake_times_end = function(input, earlier_input=null){
            
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
                    } else if(min_nearest_five > 60){
                      split[0]++;
                      min_nearest_five = (min_nearest_five - 60);
                    }


                    if(earlier_input && earlier_input.indexOf(":") > -1){
                            // console.log("total calculated?");
                            // console.log("earlier_input: ", earlier_input);
                            // console.log("input: ", input);
                            var esplit = earlier_input.split(":");
                            var ehour = esplit[0];
                            var emin = esplit[1];
                            var etot = (parseInt(ehour)*60) + parseInt(emin); 
                            // console.log("etot: ", etot);
                            var hr = split[0];
                            var mn = min_nearest_five;
                            var tot = (parseInt(hr)*60) + parseInt(mn);
                            // console.log("tot: ", tot);

                            if(etot > tot){
                                //the earlier time is after the end time
                                // console.log("etot > tot");
                                min_nearest_five = parseInt(min_nearest_five) + 5;
                                if(min_nearest_five == 60){
                                    split[0]++; 
                                    min_nearest_five = "00";
                                } else if(min_nearest_five > 60){
                                    split[0]++;
                                    min_nearest_five = (min_nearest_five - 60);
                                    if(min_nearest_five < 10 ){
                                      min_nearest_five = "0"+min_nearest_five;
                                    }
                                }
                                // console.log("split: ", split[0]);
                                // console.log("min_nearest_five: ", min_nearest_five);
                            }

                    }
                    //essentially we add 5 in case something happens over the limit

                    return split[0] + ":" + min_nearest_five;
                  } else {
                    return input;
                  }
                } else {
                  return '';
                }
          

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

                $log.info("first try");
                // Try using msSaveBlob if supported
                var blob = new Blob([data], {
                    //type: contentType
                    type: 'application/pdf'
                });

                var fileURL = URL.createObjectURL(blob);
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
                            $log.info("second try");
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

                            $log.info("third try");

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


        $scope.get_icon2 = function(file){
                //console.log("FILE", file);
                if(!file || file == ""){
                    return "";
                }
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
      



    }