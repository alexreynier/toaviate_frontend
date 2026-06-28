 app.controller('DashboardClubMemberRequestsController', DashboardClubMemberRequestsController);

    DashboardClubMemberRequestsController.$inject = ['UserService', 'MemberService', 'MembershipService', 'PaymentService', 'InstructorService', 'HolidayService', 'ClubService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'LicenceService', 'NokService', '$cookies', 'ToastService', 'BsSyncService'];
    function DashboardClubMemberRequestsController(UserService, MemberService, MembershipService, PaymentService, InstructorService, HolidayService, ClubService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, LicenceService, NokService, $cookies, ToastService, BsSyncService) {
        
        var vm = this;        

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;  

        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;


        vm.noks = [];
        vm.requests = [];
        vm.auto_renew = false;

        
    




        function update_requests(){
            MembershipService.GetRequestsByClub(vm.club_id)
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

        update_requests();

            // ── Verify / fix pending invitations (manager/super-admin) ──
            // Repairs converted-user invitations stuck as pending (never accepted,
            // missing their membership-request link) so they appear in the list.
            var acc = (vm.user && vm.user.access) || {};
            var inClub = function(a){ return a && a.indexOf(parseInt(vm.club_id)) > -1; };
            vm.canReconcile = inClub(acc.manager) || inClub(acc.super_admin);
            vm.reconciling = false;
            vm.needs_membership = [];   // invitations the backend couldn't repair (no tier)

            vm.reconcileInvitations = function(){
                if (vm.reconciling) return;
                vm.reconciling = true;
                BsSyncService.ReconcileInvitations(vm.club_id).then(function(data){
                    vm.reconciling = false;
                    if (data && data.success) {
                        vm.needs_membership = data.needs_membership || [];
                        var n = data.repaired_count || (data.repaired ? data.repaired.length : 0);
                        if (n > 0) {
                            ToastService.success('Invitations Repaired', 'Repaired ' + n + ' stuck invitation' + (n === 1 ? '' : 's') + '.');
                        } else {
                            ToastService.success('All Good', 'No stuck invitations found' + (vm.needs_membership.length ? '.' : ' — everything is up to date.'));
                        }
                        if (vm.needs_membership.length) {
                            ToastService.warning('Action Needed', vm.needs_membership.length + ' invitation' + (vm.needs_membership.length === 1 ? '' : 's') + ' need a membership assigned.');
                        }
                        update_requests();
                    } else {
                        ToastService.error('Error', (data && data.message) || 'Could not verify invitations.');
                    }
                }, function(){
                    vm.reconciling = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
            };

            // Human-friendly reason for a needs_membership entry.
            vm.needsMembershipReason = function(reason){
                switch(reason){
                    case 'no_membership_selected': return 'No membership was selected';
                    case 'invalid_membership':     return 'The selected membership is invalid';
                    default:                       return reason || 'Needs a membership';
                }
            };

            // ── Inline per-row fix for needs_membership invitations ──
            // Each needs_membership item gets its own fix form: tier dropdown +
            // term-start + expiry (auto-computed from the tier's term, overridable).
            vm.joinableMemberships = [];   // [{ membership_id, membership_name, payment_term, price }]

            function loadJoinableMemberships(){
                if (vm.joinableMemberships.length) return;
                // Use the club memberships endpoint (same one the members /
                // bs-sync screens use) — it reliably returns this club's tiers.
                MembershipService.GetAllByClub(vm.club_id).then(function(data){
                    var list = angular.isArray(data) ? data : ((data && (data.memberships || data.club_memberships)) || []);
                    vm.joinableMemberships = normaliseMemberships(list);
                });
            }

            // Normalise tier objects from either GetJoinable (membership_id/
            // membership_name) or an INVALID_MEMBERSHIP club_memberships list.
            function normaliseMemberships(list){
                return (list || []).map(function(m){
                    return {
                        membership_id: m.membership_id != null ? m.membership_id : m.id,
                        membership_name: m.membership_name || m.name,
                        payment_term: m.payment_term,
                        price: m.price
                    };
                });
            }

            function toYmd(d){
                if (!d) return null;
                var dt = (d instanceof Date) ? d : new Date(d);
                if (isNaN(dt.getTime())) return null;
                var m = ('0' + (dt.getMonth() + 1)).slice(-2);
                var day = ('0' + dt.getDate()).slice(-2);
                return dt.getFullYear() + '-' + m + '-' + day;
            }

            // term-start Date + tier's payment_term → expiry Date (null if no expiry).
            function computeExpiry(start, paymentTerm){
                if (!start) return null;
                var d = (start instanceof Date) ? new Date(start.getTime()) : new Date(start);
                if (isNaN(d.getTime())) return null;
                switch (paymentTerm) {
                    case 'daily':    d.setDate(d.getDate() + 1); break;
                    case 'monthly':  d.setMonth(d.getMonth() + 1); break;
                    case 'annually': d.setFullYear(d.getFullYear() + 1); break;
                    default: return null;   // free / once (lifetime) → backend decides
                }
                return d;
            }

            function findJoinable(id){
                for (var i = 0; i < vm.joinableMemberships.length; i++) {
                    if (String(vm.joinableMemberships[i].membership_id) === String(id)) return vm.joinableMemberships[i];
                }
                return null;
            }

            // Lazily attach the fix-form fields to a needs_membership row.
            vm.ensureFixDefaults = function(nm){
                if (!nm._fix) {
                    nm._fix = { membership_id: null, term_start: new Date(), membership_ends: null, endsOverridden: false, working: false };
                }
                loadJoinableMemberships();
            };

            vm.recomputeFixExpiry = function(nm){
                if (!nm._fix || nm._fix.endsOverridden) return;
                var m = findJoinable(nm._fix.membership_id);
                nm._fix.membership_ends = m ? computeExpiry(nm._fix.term_start, m.payment_term) : null;
            };
            vm.onFixExpiryEdited = function(nm){ if (nm._fix) nm._fix.endsOverridden = true; };

            // Submit the per-row repair.
            vm.repairInvitation = function(nm){
                if (!nm._fix || nm._fix.working) return;
                if (!nm._fix.membership_id) {
                    ToastService.warning('Membership Required', 'Please choose a membership.');
                    return;
                }
                nm._fix.working = true;
                var payload = {
                    membership_id: nm._fix.membership_id,
                    term_start: toYmd(nm._fix.term_start),
                    membership_ends: toYmd(nm._fix.membership_ends)
                };
                BsSyncService.RepairInvitation(vm.club_id, nm.invitation_id, payload).then(function(data){
                    nm._fix.working = false;
                    if (data && data.success) {
                        ToastService.success('Invitation Fixed', (nm.email || 'The invitation') + ' has been assigned a membership and is now valid.');
                        // Drop this row from the warning box.
                        vm.needs_membership = vm.needs_membership.filter(function(x){ return x.invitation_id !== nm.invitation_id; });
                        update_requests();
                    } else if (data && data.error === 'INVALID_MEMBERSHIP') {
                        if (data.club_memberships) {
                            vm.joinableMemberships = normaliseMemberships(data.club_memberships);
                        }
                        nm._fix.membership_id = null;
                        ToastService.warning('Invalid Membership', 'That membership is not valid for this club. Please pick another.');
                    } else {
                        ToastService.error('Error', (data && data.message) || 'Could not fix this invitation.');
                    }
                }, function(){
                    nm._fix.working = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
            };

            // ══════════════════════════════════════════════════════════════
            //  View / re-assign a request's membership tier + term dates
            //  (inline expandable editor on each request row)
            // ══════════════════════════════════════════════════════════════
            // The tier dropdown reuses vm.joinableMemberships (loaded lazily, the
            // same correctly-keyed list the fix form uses — binds the real
            // membership_id). Saving uses MembershipService.UpdateRequests, which
            // PUTs to /api/v1/memberships/request/{id}.

            vm.editingRequestId = null;   // id of the request whose editor is open

            // Pull a display label for a request's current tier (best-effort from
            // whatever the backend returns on the request row).
            vm.requestTierName = function(request){
                return request.membership_name || (request.membership && request.membership.membership_name) || null;
            };

            // Parse a backend date string ("YYYY-MM-DD" or similar) to a Date for
            // the <input type="date"> model; null/blank → null.
            function parseYmd(v){
                if (!v) return null;
                var d = (v instanceof Date) ? v : new Date(v);
                return isNaN(d.getTime()) ? null : d;
            }

            // Open the inline editor for a request, seeding it from current values.
            vm.toggleEditRequest = function(request){
                if (vm.editingRequestId === request.id) {
                    vm.editingRequestId = null;
                    return;
                }
                loadJoinableMemberships();
                request._edit = {
                    membership_id: (request.membership_id != null ? request.membership_id
                                    : (request.membership && request.membership.membership_id)) || null,
                    term_start: parseYmd(request.term_start || request.membership_start ||
                                         (request.membership && request.membership.membership_start)) || new Date(),
                    membership_ends: parseYmd(request.membership_ends || request.membership_end ||
                                             (request.membership && request.membership.membership_end)),
                    endsOverridden: false,
                    working: false
                };
                vm.editingRequestId = request.id;
            };

            vm.cancelEditRequest = function(request){
                if (request) request._edit = null;
                vm.editingRequestId = null;
            };

            // Re-derive expiry from chosen tier + start, unless the admin edited it.
            vm.recomputeRequestExpiry = function(request){
                var e = request._edit;
                if (!e || e.endsOverridden) return;
                var m = findJoinable(e.membership_id);
                e.membership_ends = m ? computeExpiry(e.term_start, m.payment_term) : null;
            };
            vm.onRequestExpiryEdited = function(request){ if (request._edit) request._edit.endsOverridden = true; };

            // Persist the re-assigned membership + term dates.
            vm.saveRequestMembership = function(request){
                var e = request._edit;
                if (!e || e.working) return;
                if (!e.membership_id) {
                    ToastService.warning('Membership Required', 'Please choose a membership.');
                    return;
                }
                e.working = true;
                var payload = {
                    membership_id: e.membership_id,
                    term_start: toYmd(e.term_start),
                    membership_ends: toYmd(e.membership_ends)
                };
                MembershipService.UpdateRequests(request.id, payload).then(function(data){
                    e.working = false;
                    if (data && data.success !== false) {
                        ToastService.success('Membership Updated', 'The membership for ' + (request.first_name || 'this request') + ' has been updated.');
                        vm.editingRequestId = null;
                        request._edit = null;
                        update_requests();
                    } else {
                        ToastService.error('Error', (data && data.message) || 'Could not update the membership.');
                    }
                }, function(){
                    e.working = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
            };

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

        





            $scope.accept_request = function(id){

                //basic checks...
                var obj = {
                    status: "Accepted"
                };

                MembershipService.ClubAcceptRequest(id, obj)
                .then(function (data) {
                    // //console.log("ACCEPT HERE", data);
                    //vm.memberships = data;

                    update_requests();

                    // $state.go('dashboard.my_account.memberships', {}, {reload: true});

                }); 

            }


            $scope.decline_request = function(id){
                // Mirror accept_request: the generic request-update endpoint sets
                // the status (Accept → "Accepted", Decline → "Declined"). The view
                // passes request.id, so take it as a parameter (the old version used
                // an unset vm.this_req and a non-existent ClubDeclineRequest).
                MembershipService.UpdateRequests(id, { status: "Declined" })
                .then(function (data) {
                    if (data && data.success !== false) {
                        ToastService.success('Request Declined', 'The membership request has been declined.');
                    } else {
                        ToastService.error('Error', (data && data.message) || 'Could not decline this request.');
                    }
                    update_requests();
                }, function () {
                    ToastService.error('Error', 'Could not connect to the server.');
                });
            }


          

            // $scope.delete_request = function(){


            //     MembershipService.ClubDeclineRequest(vm.this_req.id)
            //     .then(function (data) {
            //         //console.log("DECLINE HERE", data);
            //         //vm.memberships = data;

            //         update_requests();

            //         // $state.go('dashboard.my_account.memberships', {}, {reload: true});

            //     }); 

            // }







            $scope.delete_request = function(id){
                MembershipService.DeleteRequest(id)
                .then(function (data) {
                    //console.log("DELETE HERE", data);


                    update_requests();
                }); 
            }

             $scope.resend_request = function(id){
                MembershipService.ResendRequest({request_id: id})
                .then(function (data) {
                    //vm.memberships = data;

                    if(data.success){
                        ToastService.success('Request Sent', 'Request re-sent. Please ask them to check their junk / spam folders if they do not see it within the next 5 minutes.')
                    }

                    update_requests();
                }); 
            }


        
        


    }