 app.controller('PassengerSignupController', PassengerSignupController);

    PassengerSignupController.$inject = ['UserService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$http', 'ToastService'];
    function PassengerSignupController(UserService, $rootScope, $location, $scope, $state, $stateParams, $http, ToastService) {
        	

	    	 //console.log("HELLO");
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

		    // Step 2: Validate profile (called from form-profile)
		    $scope.validateProfile = function() {
		        $scope.formErrors = {};
		        var valid = true;

		        if (!$scope.formData.first_name || !$scope.formData.first_name.trim()) {
		            $scope.formErrors.first_name = true; valid = false;
		        }
		        if (!$scope.formData.last_name || !$scope.formData.last_name.trim()) {
		            $scope.formErrors.last_name = true; valid = false;
		        }
		        if (!$scope.formData.email || !$scope.formData.email.trim()) {
		            $scope.formErrors.email = true; valid = false;
		        }
		        if (!$scope.formData.dob) {
		            $scope.formErrors.dob = true; valid = false;
		        }

		        // Guardian validation if under 18
		        if ($scope.guardian) {
		            if (!$scope.formData.guardian) $scope.formData.guardian = {};
		            if (!$scope.formData.guardian.first_name || !$scope.formData.guardian.first_name.trim()) {
		                $scope.formErrors.guardian_first_name = true; valid = false;
		            }
		            if (!$scope.formData.guardian.last_name || !$scope.formData.guardian.last_name.trim()) {
		                $scope.formErrors.guardian_last_name = true; valid = false;
		            }
		            if (!$scope.formData.guardian.dob) {
		                $scope.formErrors.guardian_dob = true; valid = false;
		            }
		            if (!$scope.formData.guardian.guardianship || !$scope.formData.guardian.guardianship.trim()) {
		                $scope.formErrors.guardian_guardianship = true; valid = false;
		            }
		        }

		        if (!valid) {
		            ToastService.warning('Missing Fields', 'Please fill in all required fields.');
		            scrollToFirstError();
		            return;
		        }

		        $scope.formStep = 3;
		        $scope.next_of_kin();
		    };

		    // Step 3: Validate next of kin (called from form-nok)
		    $scope.validateNok = function() {
		        $scope.formErrors = {};
		        var valid = true;

		        if (!$scope.formData.nok) $scope.formData.nok = {};

		        if (!$scope.formData.nok.first_name || !$scope.formData.nok.first_name.trim()) {
		            $scope.formErrors.first_name = true; valid = false;
		        }
		        if (!$scope.formData.nok.last_name || !$scope.formData.nok.last_name.trim()) {
		            $scope.formErrors.last_name = true; valid = false;
		        }
		        if (!$scope.formData.nok.phone_number || !$scope.formData.nok.phone_number.trim()) {
		            $scope.formErrors.phone_number = true; valid = false;
		        }
		        if (!$scope.formData.nok.email_address || !$scope.formData.nok.email_address.trim()) {
		            $scope.formErrors.email_address = true; valid = false;
		        }
		        if (!$scope.formData.nok.relationship || !$scope.formData.nok.relationship.trim()) {
		            $scope.formErrors.relationship = true; valid = false;
		        }
		        if (!$scope.formData.nok.address || !$scope.formData.nok.address.trim()) {
		            $scope.formErrors.address = true; valid = false;
		        }

		        if (!valid) {
		            ToastService.warning('Missing Fields', 'Please fill in all required next of kin fields.');
		            scrollToFirstError();
		            return;
		        }

		        $scope.formStep = 4;
		        $scope.check_nok();
		    };


        	if($scope.formData.password && $scope.formData.password !== "" && $scope.formData.password == $scope.formData.password2){

        		$scope.submit_button = "SUBMIT INFORMATION & CREATE YOUR ACCOUNT";
        	
        	}




         	// we will store all of our form data in this object
		    if($stateParams.token){

    				////console.log("STATE", $state.current.url);

    				if(!$scope.checked_identity && $state.current.url !== "/check"){
    					$state.go("passenger_signup.check");
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




		    var calculate_age = function(birthday) { // birthday is a date
		    	//console.log(birthday);
			    var ageDifMs = Date.now() - birthday.getTime();
			    var ageDate = new Date(ageDifMs); // miliseconds from epoch
			    return Math.abs(ageDate.getUTCFullYear() - 1970);
			}

			$scope.guardian = false;

			$scope.validate_age = function(){
				if(checking_validity()){
					//console.log($scope.formData.passenger);
					var age = calculate_age($scope.formData.dob);
					//console.log("age is : "+age);
					if(age < 18){
						//$state.go(under);
						$scope.guardian = true;
					} else {
						//$state.go(over);
						$scope.guardian = false;
					}
				}
			}




			$scope.next_of_kin = function(){
		    	 if(! $('#signup-form')[0].checkValidity()){
		    		$(".ng-pristine").not(".ng-valid").removeClass("ng-pristine").addClass("ng-invalid");
		    		//console.log("STOP");
		    		return false;
		    	}
				$state.go('passenger_signup.next_of_kin');
			}

			var checking_validity = function(){
		    	// if(! $('#signup-form')[0].checkValidity()){
		    	// 	$(".ng-pristine").not(".ng-valid").removeClass("ng-pristine").addClass("ng-invalid");
		    	// 	//console.log("STOP");
		    	// 	return false;
		    	// } else {
		    	// 	if(!$scope.formData.passenger){
				   //  		$state.go("user_signup.your_profile");
		    	// 	}
		    	// 	// if($scope.formData.user.password == $scope.formData.user.password2){
			    // 	// 	$state.go(uisref);
		    	// 	// } else {
			    // 	// 	$("input[type='password']").removeClass("ng-pristine").addClass("ng-invalid");
		    	// 	// 	return false;
		    	// 	// }
		    	// }
		    	return true;
		    }

		    $scope.check_nok = function(){
		    	if(! $('#signup-form')[0].checkValidity()){
		    		$(".ng-pristine").not(".ng-valid").removeClass("ng-pristine").addClass("ng-invalid");
		    		//console.log("STOP");
		    		return false;
		    	}
		    	$state.go("passenger_signup.tnc");
		    }
		    
		    $scope.checkValid = function(uisref){
		    	if(!uisref){
		    		uisref = $(".btn-info").attr("one-ui-sref") || $(".inv-btn--primary").attr("one-ui-sref") || $(".inv-btn--success").attr("one-ui-sref");
		    	}
		    	//if less than 18 show the guardian form
		    	if(checking_validity()){
			    	if($scope.formData.password == $scope.formData.password2){
			    		$state.go(uisref);
		    		} else {
			    		$("input[type='password']").removeClass("ng-pristine").addClass("ng-invalid");
		    			return false;
		    		}
			    	//console.log($('#signup-form')[0].checkValidity());
			    } else {
			    	return false;
			    }
		    	
		    }

		    $scope.submitting = false;
		    $scope.submitError = '';

		    $scope.submit_passenger = function(){

		    	if ($scope.submitting) return;
		    	$scope.submitError = '';

		    	//verification of the profile page
		    	if(! $scope.formData.first_name || ! $scope.formData.last_name || ! $scope.formData.email || ! $scope.formData.dob){
		    		ToastService.warning('Incomplete Details', 'Please complete your personal details');
		    		$state.go("passenger_signup.your_profile");
		    		return false;
		    	}

		    	if(calculate_age($scope.formData.dob) < 18){
		    		//need to confirm guardian information was filled out
		    		if( !$scope.formData.guardian || ! $scope.formData.guardian.first_name || ! $scope.formData.guardian.last_name || ! $scope.formData.guardian.dob || ! $scope.formData.guardian.guardianship ){
		    			ToastService.warning('Guardian Required', 'As you are under the age of 18, your guardian needs to complete their details.');
			    		$state.go("passenger_signup.your_profile");
			    		return false;
		    		}

		    		if(calculate_age($scope.formData.guardian.dob) < 18){
		    			ToastService.warning('Invalid Guardian', 'Your guardian needs to be over the age of 18 to legally enable you to go flying.');
		    			$state.go("passenger_signup.your_profile");
			    		return false;
		    		}

		    	}

		    	//this is the first page of verifications complete - now we need to do the NOK checks, and the TnC checks then we're good to go and create this.create
		    	if(! $scope.formData.nok || ! $scope.formData.nok.first_name || ! $scope.formData.nok.last_name || ! $scope.formData.nok.email_address || ! $scope.formData.nok.relationship || ! $scope.formData.nok.phone_number  || ! $scope.formData.nok.address){
		    			ToastService.warning('Missing Next of Kin', 'Your next of kin information needs to be complete - in case of an emergency, or an accident, we must be able to contact them.');
		    			$state.go("passenger_signup.next_of_kin");
			    		return false;
		    	}

		    	//and now we verify the terms and conditions that have been agreed

		    	if(! $scope.formData.tnc || ! $scope.formData.club_tnc){
		    		ToastService.warning('Terms Required', 'Please tick to confirm that you have read, understood and agreed to the terms and conditions of both the software and the flight organisation.');
			    	return false;
		    	}


		    	//if we get here we have a fully completed form and are ready to send it to create a user.



		    	//let us prepare the content that needs to be sent back here:::
		    	var self_dob = new Date($scope.formData.dob);

		    	if($scope.formData.guardian){
			    	$scope.formData.guardian.dob = $scope.formData.guardian.dob.format("yyyy-MM-dd")
		    	}

		    	var to_send = {
		    		user_id: $scope.formData.user_id,
		    		first_name: $scope.formData.first_name,
		    		last_name: $scope.formData.last_name,
		    		email: $scope.formData.email,
		    		dob: $scope.formData.dob.format("yyyy-MM-dd"),
		    		club_id: $scope.formData.club_id,
		    		club_tnc: $scope.formData.club_tnc,
		    		tnc: $scope.formData.tnc,
		    		nok: $scope.formData.nok,
		    		guardian: $scope.formData.guardian,
		    		booking_id: $scope.formData.booking_id,
		    		token: $scope.formData.token,
		    		membership_id: 0,
		    		invited_by: $scope.formData.invited_by,
		    		voucher_id: $scope.formData.voucher_id || null
		    	}

		    	$scope.submitting = true;

	    		UserService.ConfirmPaxInvite($stateParams.token, to_send)
                .then(function (data) {
                	if(data.success){
				    	
                		//this is successful - now let's clear the contents:
                		$scope.formData = {};
                		//and let's remove the top links
                		$scope.checked_identity = false;

                		// Clear any stored return URL so the user's first login
                		// goes to the dashboard, not back to this signup form
                		try { localStorage.removeItem('toaviate_return_url'); } catch(e) {}

                	}

                }, function () {
                	$scope.submitError = 'We couldn\'t reach the server. Please check your connection and try again.';
                	ToastService.error('Connection Error', 'We couldn\'t reach the server. Please check your connection and try again.');
                })
                ['finally'](function () {
                	$scope.submitting = false;
                });


		    }





		    $scope.downloadClubDocument = function(doc) {
            var data = $.param({
                id: doc
            });

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

		       // Clear existing code inputs
		       $scope.formcode = [];
		       for (var i = 0; i < 6; i++) {
		           var el = document.getElementById('index' + i);
		           if (el) el.value = '';
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

		   // Fill all 6 boxes from a string (paste or autofill)
		   function fillCodeFromString(raw) {
		       var digits = raw.replace(/\D/g, '').substring(0, CODE_LENGTH);
		       if (!digits.length) return;
		       $scope.formcode = [];
		       for (var i = 0; i < CODE_LENGTH; i++) {
		           $scope.formcode[i] = digits[i] !== undefined ? parseInt(digits[i]) : '';
		           var el = document.getElementById('index' + i);
		           if (el) el.value = $scope.formcode[i] !== '' ? $scope.formcode[i] : '';
		       }
		       // Focus the next empty box, or the last one
		       var focusIdx = Math.min(digits.length, CODE_LENGTH - 1);
		       var focusEl = document.getElementById('index' + focusIdx);
		       if (focusEl) focusEl.focus();
		       // Auto-submit if all 6 digits arrived
		       if (digits.length >= CODE_LENGTH) {
		           $scope.submitCode();
		       }
		   }

		   // Handle keydown for navigation (backspace, arrows, tab)
		   $scope.onCodeKeydown = function(event, idx) {
		       var key = event.key || event.keyCode;

		       // Backspace – clear current or move back
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

		       // Left arrow
		       if (key === 'ArrowLeft' || key === 37) {
		           event.preventDefault();
		           if (idx > 0) document.getElementById('index' + (idx - 1)).focus();
		           return;
		       }

		       // Right arrow
		       if (key === 'ArrowRight' || key === 39) {
		           event.preventDefault();
		           if (idx < CODE_LENGTH - 1) document.getElementById('index' + (idx + 1)).focus();
		           return;
		       }

		       // Digit key – write it and advance
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

		           // Auto-submit when the last digit is entered
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

		       // Allow Cmd/Ctrl+V through for paste handler
		       if ((event.metaKey || event.ctrlKey) && (key === 'v' || key === 86)) {
		           return; // let the paste event fire
		       }

		       // Block anything else that isn't Tab or navigation
		       if (key !== 'Tab' && key !== 9) {
		           event.preventDefault();
		       }
		   };

		   // Handle input event (catches autofill, mobile keyboards, etc.)
		   $scope.onCodeInput = function(event, idx) {
		       var el = event.target || event.srcElement;
		       var val = el.value;

		       // If multiple characters arrived (autofill/paste that slipped through)
		       if (val && val.length > 1) {
		           fillCodeFromString(val);
		           return;
		       }

		       // Single digit
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

		   // Paste handler – attach to each input via native event
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
		                   // Also select content on focus for easy overwrite
		                   el.addEventListener('focus', function() {
		                       this.select();
		                   });
		               }
		           })(i);
		       }
		   }

		   // Attach after Angular renders the template
		   setTimeout(attachPasteHandlers, 200);
		   // Re-attach when navigating back to check view
		   $scope.$on('$viewContentLoaded', function() {
		       setTimeout(attachPasteHandlers, 200);
		   });

		   // Submit / verify code
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

		       UserService.GetPaxSecureInvite($stateParams.token, combine)
                .then(function (data) {
                	$scope.codeVerifying = false;

                	if(data.success){

                		if(data.invitation.is_already_user){

                			$scope.is_already_user = true;

							$scope.formData.user_id = data.invitation.user_id;
							$scope.formData.first_name = data.invitation.user.first_name;
                			$scope.formData.last_name = data.invitation.user.last_name;
                			$scope.formData.email = data.invitation.user.email;
                			$scope.formData.dob = new Date(data.invitation.user.dob);
                			$scope.formData.club = data.invitation.club;
                			$scope.formData.guardian = data.invitation.user.guardian;
                			$scope.formData.nok = data.invitation.user.nok;
                			$scope.formData.membership_id = data.invitation.membership_id;
                			$scope.formData.club_id = data.invitation.club_id;
                			$scope.formData.token = data.invitation.invitation_token;
                			$scope.formData.status = data.invitation.status;
                			$scope.formData.invited_by = data.invitation.invited_by;
                			$scope.formData.booking_id = data.invitation.booking_id;

                			// Voucher-linked invitation support
                			if (data.invitation.voucher_id) {
                				$scope.formData.voucher_id = data.invitation.voucher_id;
                			}

                			if(data.invitation.user.guardian && data.invitation.user.guardian.first_name !== ""){
                				$scope.guardian = true;
                			}

                		} else {

                			$scope.formData.first_name = data.invitation.first_name;
                			$scope.formData.last_name = data.invitation.last_name;
                			$scope.formData.email = data.invitation.email;
                			$scope.formData.membership_id = data.invitation.membership_id;
                			$scope.formData.club_id = data.invitation.club_id;
                			$scope.formData.token = data.invitation.invitation_token;
                			$scope.formData.status = data.invitation.status;
                			$scope.formData.invited_by = data.invitation.invited_by;
                			$scope.formData.booking_id = data.invitation.booking_id;
                			$scope.formData.club = data.invitation.club;

                			// Voucher-linked invitation support
                			if (data.invitation.voucher_id) {
                				$scope.formData.voucher_id = data.invitation.voucher_id;
                			}

                		}

                		$scope.checked_identity = true;
                		$state.go("passenger_signup.your_profile");

                	} else {
                		// Shake the inputs and show error
                		$scope.codeError = data.message || 'Invalid code. Please try again.';
                		var group = document.getElementById('codeInputGroup');
                		if (group) {
                		    group.classList.add('inv-code-inputs--shake');
                		    setTimeout(function() { group.classList.remove('inv-code-inputs--shake'); }, 500);
                		}
                		// Clear and refocus first box
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

		





		    // $scope.submit_button_data = function(){
		    // 	if($scope.formData.password && $scope.formData.password !== "" && $scope.formData.password == $scope.formData.password2){

	     //    		$scope.submit_button = "SUBMIT INFORMATION & CREATE YOUR ACCOUNT";
	        	
	     //    	} else {
	     //    		$scope.submit_button = "SUBMIT INFORMATION & GO FLYING";
	     //    	}
		    // }











   //       	$scope.clubs = { clubs: [
			//     	{
			//     		id: 1,
			//     		title: "Alouette Flying Club"
			//     	},
			//     	{
			//     		id: 2,
			//     		title: "EFG Flying Club"
			//     	},
			//     	{
			//     		id: 3,
			//     		title: "Surrey & Kent Flying Club"
			//     	},
			//     	{
			//     		id: 4,
			//     		title: "Arrow Flight Club"
			//     	},
			//     	{
			//     		id: 5,
			//     		title: "Cirrus Flying Club"
			//     	}
		 //    	]		    	
		 //    };


		 //    $scope.memberships = { memberships: [
			//     	{
			//     		id: 1,
			//     		title: "honory membership"
			//     	},
			//     	{
			//     		id: 2,
			//     		title: "day membership"
			//     	},
			//     	{
			//     		id: 3,
			//     		title: "social membership"
			//     	},
			//     	{
			//     		id: 4,
			//     		title: "full flying membership"
			//     	},
			//     	{
			//     		id: 5,
			//     		title: "temporary flying membership"
			//     	}
		 //    	]		    	
		 //    };

		 //    $scope.state = { state: [
			//     	{
			//     		id: 2,
			//     		title: "France"
			//     	},
			//     	{
			//     		id: 3,
			//     		title: "Netherlands"
			//     	},
			//     	{
			//     		id: 4,
			//     		title: "Germany"
			//     	},
			//     	{
			//     		id: 5,
			//     		title: "Spain"
			//     	}
		 //    	]		    	
		 //    };

		 //    $scope.licenses = { licenses: [
			//     	{
			//     		id: 1,
			//     		title: "EASA PPL"
			//     	},
			//     	{
			//     		id: 2,
			//     		title: "EASA CPL"
			//     	},
			//     	{
			//     		id: 3,
			//     		title: "EASA ATPL"
			//     	},
			//     	{
			//     		id: 4,
			//     		title: "UK NPPL"
			//     	},
			//     	{
			//     		id: 5,
			//     		title: "FAA SPL"
			//     	}
		 //    	]		    	
		 //    };

		 //    $scope.medicals = { medicals: [
			//     	{
			//     		id: 1,
			//     		title: "EASA MEDICAL"
			//     	},
			//     	{
			//     		id: 2,
			//     		title: "UK MEDICAL EXAMINATION"
			//     	},
			//     	{
			//     		id: 3,
			//     		title: "FAA MEDICAL"
			//     	},
			//     	{
			//     		id: 4,
			//     		title: "NZ CAA MEDICAL"
			//     	},
			//     	{
			//     		id: 5,
			//     		title: "FAA SPL MEDICAL"
			//     	}
		 //    	]		    	
		 //    };

		 //    $scope.person = {};

		 //    $scope.person.selectedSingle = 'Samantha';
		 //  	$scope.person.selectedSingleKey = '5';

		 //  	$scope.people = [
			//     { name: 'Adam',      email: 'adam@email.com',      age: 12, country: 'United States' },
			//     { name: 'Amalie',    email: 'amalie@email.com',    age: 12, country: 'Argentina' },
			//     { name: 'EstefanÃ­a', email: 'estefania@email.com', age: 21, country: 'Argentina' },
			//     { name: 'Adrian',    email: 'adrian@email.com',    age: 21, country: 'Ecuador' },
			//     { name: 'Wladimir',  email: 'wladimir@email.com',  age: 30, country: 'Ecuador' },
			//     { name: 'Samantha',  email: 'samantha@email.com',  age: 30, country: 'United States' },
			//     { name: 'Nicole',    email: 'nicole@email.com',    age: 43, country: 'Colombia' },
			//     { name: 'Natasha',   email: 'natasha@email.com',   age: 54, country: 'Ecuador' },
			//     { name: 'Michael',   email: 'michael@email.com',   age: 15, country: 'Colombia' },
			//     { name: 'NicolÃ¡s',   email: 'nicolas@email.com',    age: 43, country: 'Colombia' }
		 //  	];





		 //    $scope.ratings = { ratings: [
			    	
			// 		{
			//     		id: 1,
			//     		title: "SEP (land)"
			//     	},
			//     	{
			//     		id: 2,
			//     		title: "SEP (sea)"
			//     	},
			//     	{
			//     		id: 3,
			//     		title: "MEP (land)"
			//     	},
			//     	{
			//     		id: 4,
			//     		title: "MEP (sea)"
			//     	},
			    	
			//     	{
			//     		id: 1,
			//     		title: "Night Rating"
			//     	},
			//     	{
			//     		id: 2,
			//     		title: "Instrument Rating Restricted IR(r)"
			//     	},
			//     	{
			//     		id: 3,
			//     		title: "Instrument Rating"
			//     	},
			//     	{
			//     		id: 4,
			//     		title: "Aerobatics Rating"
			//     	},
			//     	{
			//     		id: 5,
			//     		title: "High Performance Aircraft Rating"
			//     	}
		 //    	]		    	
		 //    };

		 //    $scope.differences = { differences: [
			//     	{
			//     		id: 1,
			//     		title: "Variable Pitch"
			//     	},
			//     	{
			//     		id: 2,
			//     		title: "Retractable Gear"
			//     	},
			//     	{
			//     		id: 3,
			//     		title: "Turbo Differences Training"
			//     	},
			//     	{
			//     		id: 4,
			//     		title: "EFIS Differences Training"
			//     	}
		 //    	]		    	
		 //    };


		 //    //may need to alter this one to reflect most common one depending on
		 //    //the license type
		 //    $scope.formData = {
		 //    	passenger: {}
		 //    };

		 //    var calculate_age = function(birthday) { // birthday is a date
		 //    	//console.log(birthday);
			//     var ageDifMs = Date.now() - birthday.getTime();
			//     var ageDate = new Date(ageDifMs); // miliseconds from epoch
			//     return Math.abs(ageDate.getUTCFullYear() - 1970);
			// }

			// $scope.validate_age = function(under, over){
			// 	if(checking_validity()){
			// 		//console.log($scope.formData.passenger);
			// 		var age = calculate_age($scope.formData.passenger.dob);
			// 		//console.log("age is : "+age);
			// 		if(age < 18){
			// 			$state.go(under);
			// 		} else {
			// 			$state.go(over);
			// 		}
			// 	}
			// }

		 //    $scope.add_element = function(bit_type){

		 //    	//remove from first array
		 //    	$scope[bit_type][bit_type] = $.grep($scope[bit_type][bit_type], function(e){ 
			// 		return e.id != $scope.formData.license.add_to[bit_type].id; 
			// 	});

		 //    	if(bit_type == "differences"){
		 //    		$scope.formData.license.add_to[bit_type].day = true;
		 //    		$scope.formData.license.add_to[bit_type].vfr = true;
		 //    	}
		 //    	//console.log($scope.formData.license.add_to[bit_type]);

		 //    	$scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);
		    	
		 //    	//clean the array to show what we want to show :)
		 //    	delete $scope.formData.license.add_to[bit_type];

		 //    }


		 //    $scope.remove_element = function(bit_type, index){

		 
 		// 		//add to dropdown
			// 	$scope[bit_type][bit_type].push($scope.formData.license[bit_type][index]);

		    
			// 	$scope.formData.license[bit_type].splice(index,1)

		 //    	$scope.formData.license[bit_type] = $scope.formData.license[bit_type].filter(Boolean);
		 //    	//console.log($scope.formData.license[bit_type]);
		 //    	//$scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);

		 //    }

		 //    var checking_validity = function(){
		 //    	if(! $('#signup-form')[0].checkValidity()){
		 //    		$(".ng-pristine").not(".ng-valid").removeClass("ng-pristine").addClass("ng-invalid");
		 //    		//console.log("STOP");
		 //    		return false;
		 //    	} else {
		 //    		if(!$scope.formData.passenger){
			// 	    		$state.go("user_signup.your_profile");
		 //    		}
		 //    		// if($scope.formData.user.password == $scope.formData.user.password2){
			//     	// 	$state.go(uisref);
		 //    		// } else {
			//     	// 	$("input[type='password']").removeClass("ng-pristine").addClass("ng-invalid");
		 //    		// 	return false;
		 //    		// }
		 //    	}
		 //    	return true;
		 //    }
		    
		 //    $scope.checkValid = function(uisref){
		 //    	if(!uisref){
		 //    		uisref = $(".btn-info").attr("one-ui-sref");
		 //    	}
		 //    	//if less than 18 show the guardian form
		 //    	if(checking_validity()){
			//     	if($scope.formData.passenger.password == $scope.formData.passenger.password2){
			//     		$state.go(uisref);
		 //    		} else {
			//     		$("input[type='password']").removeClass("ng-pristine").addClass("ng-invalid");
		 //    			return false;
		 //    		}
			//     	//console.log($('#signup-form')[0].checkValidity());
			//     } else {
			//     	return false;
			//     }
		    	
		 //    }


		 //    // function to process the form
		 //    $scope.processForm = function() {
		 //         if ($scope.formData.$valid) {
	  //               alert('our form is amazing');
	  //           } 
		 //    };

    }






