 app.controller('PassengerSignupCompleteController', PassengerSignupCompleteController);

    PassengerSignupCompleteController.$inject = ['UserService', '$rootScope', '$location', '$scope', '$state', '$stateParams', 'ToastService', 'SignupPreviewService', 'PasswordPolicyService'];
    function PassengerSignupCompleteController(UserService, $rootScope, $location, $scope, $state, $stateParams, ToastService, SignupPreviewService, PasswordPolicyService) {
        	

	    	 ////console.log("HELLO");
		    ////console.log($scope.membership);


		    var vm = this;

		    $scope.checked_identity = false;
		    $scope.is_already_user = false;

		    $scope.submit_button = "SUBMIT INFORMATION";


        	$scope.formData = {};

		    // ── Modern form validation infrastructure ──
		    $scope.formErrors = {};
		    $scope.formStep = 1;

		    $scope.setFormStep = function(n) {
		        $scope.formStep = n;
		    };

		    $scope.clearFormError = function(field) {
		        if ($scope.formErrors[field]) {
		            delete $scope.formErrors[field];
		        }
		    };

		    function scrollToFirstError() {
		        setTimeout(function() {
		            var el = document.querySelector('.inv-field--error');
		            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		        }, 100);
		    }

		    // Design preview: tokens starting with "preview" simulate the
		    // identity check and submission locally (non-production only).
		    var isPreview = SignupPreviewService.IsPreview($stateParams.token);

		    // Live password-requirements checklist under the password field.
		    $scope.pwCheck = PasswordPolicyService.Rules;

		    // ── Refresh / back-forward robustness ──────────────────────────
		    // This flow only collects a password (never stored), so there is
		    // no draft to save — but the stepper should follow the current
		    // state, including across a refresh or browser back/forward.
		    var STEP_BY_STATE = {
		        'passenger_signup_complete.check':        1,
		        'passenger_signup_complete.your_profile': 2,
		        'passenger_signup_complete.thank_you':    3
		    };

		    function syncStepFromState(stateName) {
		        if (STEP_BY_STATE[stateName]) {
		            $scope.formStep = STEP_BY_STATE[stateName];
		        }
		    }

		    syncStepFromState($state.current.name);
		    $scope.$on('$stateChangeSuccess', function (event, toState) {
		        syncStepFromState(toState.name);
		    });


        	if($scope.formData.password && $scope.formData.password !== "" && $scope.formData.password == $scope.formData.password2){

        		$scope.submit_button = "SUBMIT INFORMATION & CREATE YOUR ACCOUNT";
        	
        	}




         	// we will store all of our form data in this object
		    if($stateParams.token){

    				////console.log("STATE", $state.current.url);

    				if(!$scope.checked_identity && $state.current.url !== "/check"){
    					$state.go("passenger_signup_complete.check");
    				}

    			// UserService.GetInvite($stateParams.token)
       //          .then(function (data) {
	    		// 	////console.log("GETTING TOKEN", data);


       //              if(data){

       //              	$scope.total_invite = data;
                    	
       //              	$scope.formData.first_name = data.first_name;
		    	// 		$scope.formData.last_name = data.last_name;
		    	// 		$scope.formData.email = data.email;
		    	// 		$scope.formData.membership_id = data.membership_id;
		    	// 		$scope.formData.club_id = data.club_id;
		    	// 		$scope.formData.to_pay = data.to_pay;
		    	// 		$scope.formData.token = data.invitation_token;

		    	// 		//maybe?
		    	// 		$scope.formData.invited_by = data.invited_by;

		    	// 		if(data.user_id > 0){
		    	// 			//console.log("UID set", data.user_id);
		    	// 			$cookies.put("uid", data.user_id);
		    	// 		}

		    	// 		//$cookies.set("rid", data.membership.request.membership_request_id);
		    	// 		//other data::

		    	// 		$scope.club = data.club;
		    	// 		$scope.membership = data.membership;

		    	// 		$scope.all = data;

       //              	////console.log("success");
       //              } else {
       //              	alert("Sorry we were unable to find this invitation... Please try clicking the link again.")
       //              	$state.go("login");
       //              }
       //          });

    		} else {

    			$state.go("login");
    		}



    		$scope.gotologin = function(){
    			$state.go("login");
    		}
		    
		    // $scope.checkValid = function(uisref){
		    // 	if(!uisref){
		    // 		uisref = $(".btn-info").attr("one-ui-sref");
		    // 	}
		    // 	//if less than 18 show the guardian form
		    // 	if(checking_validity()){
			   //  	if($scope.formData.password == $scope.formData.password2){
			   //  		$state.go(uisref);
		    // 		} else {
			   //  		$("input[type='password']").removeClass("ng-pristine").addClass("ng-invalid");
		    // 			return false;
		    // 		}
			   //  	//console.log($('#signup-form')[0].checkValidity());
			   //  } else {
			   //  	return false;
			   //  }
		    	
		    // }



		    $scope.formcode = [];
		   $scope.checkedcode = 0;
		   $scope.codeVerifying = false;
		   $scope.codeError = '';

		   // ── Resend code ──
		   $scope.resendCooldown = 0;
		   $scope.resendSending = false;
		   $scope.resendMessage = '';
		   $scope.resendMessageType = '';
		   $scope.resendMaxed = false;

		   var resendTimer = null;
		   function startResendCooldown() {
		       $scope.resendCooldown = 45;
		       if (resendTimer) clearInterval(resendTimer);
		       resendTimer = setInterval(function() {
		           $scope.$apply(function() {
		               $scope.resendCooldown--;
		               if ($scope.resendCooldown <= 0) {
		                   $scope.resendCooldown = 0;
		                   clearInterval(resendTimer);
		                   resendTimer = null;
		               }
		           });
		       }, 1000);
		   }

		   $scope.resendCode = function() {
		       if ($scope.resendSending || $scope.resendCooldown > 0 || $scope.resendMaxed) return;
		       $scope.resendSending = true;
		       $scope.resendMessage = '';
		       $scope.codeError = '';

		       $scope.formcode = [];
		       for (var i = 0; i < 6; i++) {
		           var el = document.getElementById('index' + i);
		           if (el) el.value = '';
		       }

		       if (isPreview) {
		           $scope.resendSending = false;
		           $scope.resendMessage = 'Preview: a new code has been "sent" — any 6 digits will pass.';
		           $scope.resendMessageType = 'success';
		           startResendCooldown();
		           return;
		       }

		       UserService.ResendPaxCode($stateParams.token)
		           .then(function(data) {
		               $scope.resendSending = false;
		               if (data.success) {
		                   $scope.resendMessage = data.message || 'A new code has been sent to your email.';
		                   $scope.resendMessageType = 'success';
		                   startResendCooldown();
		                   setTimeout(function() { var f = document.getElementById('index0'); if (f) f.focus(); }, 200);
		               } else {
		                   $scope.resendMessage = data.message || 'Unable to resend code. Please try again.';
		                   $scope.resendMessageType = 'error';
		                   if (data.message && data.message.indexOf('Too many') > -1) {
		                       $scope.resendMaxed = true;
		                   }
		               }
		           }, function() {
		               $scope.resendSending = false;
		               $scope.resendMessage = 'Something went wrong. Please try again.';
		               $scope.resendMessageType = 'error';
		           });
		   };

		   $scope.$on('$destroy', function() {
		       if (resendTimer) clearInterval(resendTimer);
		   });

		   // ── Stripe-style smooth code input ──

		   var CODE_LENGTH = 6;

		   function fillCodeFromString(raw) {
		       var digits = raw.replace(/\D/g, '').substring(0, CODE_LENGTH);
		       if (!digits.length) return;
		       $scope.formcode = [];
		       for (var i = 0; i < CODE_LENGTH; i++) {
		           $scope.formcode[i] = digits[i] !== undefined ? parseInt(digits[i]) : '';
		           var el = document.getElementById('index' + i);
		           if (el) el.value = $scope.formcode[i] !== '' ? $scope.formcode[i] : '';
		       }
		       var focusIdx = Math.min(digits.length, CODE_LENGTH - 1);
		       var focusEl = document.getElementById('index' + focusIdx);
		       if (focusEl) focusEl.focus();
		       if (digits.length >= CODE_LENGTH) {
		           $scope.submitCode();
		       }
		   }

		   $scope.onCodeKeydown = function(event, idx) {
		       var key = event.key || event.keyCode;

		       if (key === 'Backspace' || key === 8) {
		           event.preventDefault();
		           if ($scope.formcode[idx] !== '' && $scope.formcode[idx] !== undefined) {
		               $scope.formcode[idx] = '';
		               document.getElementById('index' + idx).value = '';
		           } else if (idx > 0) {
		               $scope.formcode[idx - 1] = '';
		               var prev = document.getElementById('index' + (idx - 1));
		               if (prev) { prev.value = ''; prev.focus(); }
		           }
		           $scope.codeError = '';
		           return;
		       }

		       if (key === 'ArrowLeft' || key === 37) {
		           event.preventDefault();
		           if (idx > 0) document.getElementById('index' + (idx - 1)).focus();
		           return;
		       }

		       if (key === 'ArrowRight' || key === 39) {
		           event.preventDefault();
		           if (idx < CODE_LENGTH - 1) document.getElementById('index' + (idx + 1)).focus();
		           return;
		       }

		       var digit = null;
		       if (/^[0-9]$/.test(key)) {
		           digit = key;
		       } else if (key >= 48 && key <= 57) {
		           digit = String(key - 48);
		       } else if (key >= 96 && key <= 105) {
		           digit = String(key - 96);
		       }

		       if (digit !== null) {
		           event.preventDefault();
		           $scope.formcode[idx] = parseInt(digit);
		           document.getElementById('index' + idx).value = digit;
		           $scope.codeError = '';

		           if (idx < CODE_LENGTH - 1) {
		               document.getElementById('index' + (idx + 1)).focus();
		           }

		           if (idx === CODE_LENGTH - 1) {
		               var allFilled = true;
		               for (var i = 0; i < CODE_LENGTH; i++) {
		                   if ($scope.formcode[i] === '' || $scope.formcode[i] === undefined) { allFilled = false; break; }
		               }
		               if (allFilled) {
		                   $scope.submitCode();
		               }
		           }
		           return;
		       }

		       if ((event.metaKey || event.ctrlKey) && (key === 'v' || key === 86)) {
		           return;
		       }

		       if (key !== 'Tab' && key !== 9) {
		           event.preventDefault();
		       }
		   };

		   $scope.onCodeInput = function(event, idx) {
		       var el = event.target || event.srcElement;
		       var val = el.value;

		       if (val && val.length > 1) {
		           fillCodeFromString(val);
		           return;
		       }

		       if (val && /^[0-9]$/.test(val)) {
		           $scope.formcode[idx] = parseInt(val);
		           if (idx < CODE_LENGTH - 1) {
		               document.getElementById('index' + (idx + 1)).focus();
		           }
		       } else {
		           el.value = '';
		           $scope.formcode[idx] = '';
		       }
		   };

		   function attachPasteHandlers() {
		       for (var i = 0; i < CODE_LENGTH; i++) {
		           (function(idx) {
		               var el = document.getElementById('index' + idx);
		               if (el) {
		                   el.addEventListener('paste', function(e) {
		                       e.preventDefault();
		                       var text = (e.clipboardData || window.clipboardData).getData('text');
		                       $scope.$apply(function() {
		                           fillCodeFromString(text);
		                       });
		                   });
		                   el.addEventListener('focus', function() {
		                       this.select();
		                   });
		               }
		           })(i);
		       }
		   }

		   setTimeout(attachPasteHandlers, 200);
		   $scope.$on('$viewContentLoaded', function() {
		       setTimeout(attachPasteHandlers, 200);
		   });

		   $scope.submitCode = function() {
		       var combine = '';
		       for (var i = 0; i < CODE_LENGTH; i++) {
		           if ($scope.formcode[i] === '' || $scope.formcode[i] === undefined) {
		               $scope.codeError = 'Please enter all 6 digits.';
		               document.getElementById('index' + i).focus();
		               return;
		           }
		           combine += $scope.formcode[i];
		       }

		       $scope.checkedcode++;

		       if ($scope.checkedcode > 4) {
		           $scope.codeError = '';
		           ToastService.error('Too Many Attempts', 'Sorry - you have tried too many times, this code is now invalid and a new invitation will be sent to you.');
		           return;
		       }

		       $scope.codeVerifying = true;
		       $scope.codeError = '';

		       if (isPreview) {
		           $scope.codeVerifying = false;
		           ToastService.success('Preview', 'Identity check simulated — any code passes.');
		           $scope.formData.user_id = 1;
		           $scope.formData.token = $stateParams.token;
		           $scope.checked_identity = true;
		           $state.go("passenger_signup_complete.your_profile");
		           return;
		       }

		       UserService.GetPaxSecureInvite2($stateParams.token, combine)
                .then(function (data) {
                	$scope.codeVerifying = false;

                	if(data.success){

                		if(data.invitation.is_already_user){

                			$scope.formData.user_id = data.invitation.user_id;
                			$scope.formData.token = $stateParams.token;
                			$scope.checked_identity = true;
                			$state.go("passenger_signup_complete.your_profile");
                		} else {

                			ToastService.error('Invitation Not Found', 'We couldn\'t match your invitation with our records - if you think you have an account, please go to the login screen and click the forgotten password link.');
                			return false;
                		}

                	} else {
                		$scope.codeError = data.message || 'Invalid code. Please try again.';
                		var group = document.getElementById('codeInputGroup');
                		if (group) {
                		    group.classList.add('inv-code-inputs--shake');
                		    setTimeout(function() { group.classList.remove('inv-code-inputs--shake'); }, 500);
                		}
                		$scope.formcode = [];
                		for (var j = 0; j < CODE_LENGTH; j++) {
                		    var el = document.getElementById('index' + j);
                		    if (el) el.value = '';
                		}
                		setTimeout(function() {
                		    var first = document.getElementById('index0');
                		    if (first) first.focus();
                		}, 100);
                	}

                }, function() {
                	$scope.codeVerifying = false;
                	$scope.codeError = 'Something went wrong. Please try again.';
                });
		   };

		    $scope.submit_user_for_signup = function(){

		    	$scope.formErrors = {};

		    	// Tell the user exactly which password rule failed rather than
		    	// a generic "password issue" message.
		    	var pwMessage = PasswordPolicyService.Message($scope.formData.password);
		    	if (pwMessage) {
		    	    $scope.formErrors.password = true;
		    	    $scope.formErrors.password_msg = pwMessage;
		    	    ToastService.warning('Password Not Strong Enough', pwMessage);
		    	    scrollToFirstError();
		    	    return false;
		    	}

		    	if ($scope.formData.password !== $scope.formData.password2) {
		    	    $scope.formErrors.password2 = true;
		    	    ToastService.warning('Passwords Don\'t Match', 'Your two passwords are different — please re-type the confirmation.');
		    	    scrollToFirstError();
		    	    return false;
		    	}

		    	//prepare the items!!
		    	////console.log($scope.formData);

		    	//if we get here we have a fully completed form and are ready to send it to create a user.
		    
		    	var to_send = {
		    		user_id: $scope.formData.user_id,
		    		token: $scope.formData.token,
		    		password: $scope.formData.password
		    	}

		    	////console.log("SENDING", to_send);

		    	if (isPreview) {
		    		ToastService.success('Preview', 'Account creation simulated.');
		    		$scope.formData = {};
		    		$scope.checked_identity = false;
		    		$state.go("passenger_signup_complete.thank_you");
		    		return;
		    	}

	    		UserService.SignupUserFromPassenger($stateParams.token, to_send)
                .then(function (data) {
                	// //console.log("GET SECURE INVITE", data);
                	if(data.success){
				    	
                		//this is successful - now let's clear the contents:
                		$scope.formData = {};
                		//and let's remove the top links
                		$scope.checked_identity = false;
                		$state.go("passenger_signup_complete.thank_you");
                		
                	} else {
                		ToastService.error('Error', data.message);
                	}
                });

		    }

}


