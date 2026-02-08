 app.controller('PassengerSignupCompleteController', PassengerSignupCompleteController);

    PassengerSignupCompleteController.$inject = ['UserService', '$rootScope', '$location', '$scope', '$state', '$stateParams'];
    function PassengerSignupCompleteController(UserService, $rootScope, $location, $scope, $state, $stateParams) {
        	

	    	 ////console.log("HELLO");
		    ////console.log($scope.membership);


		    var vm = this;

		    $scope.checked_identity = false;
		    $scope.is_already_user = false;

		    $scope.submit_button = "SUBMIT INFORMATION";


        	$scope.formData = {};


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
		   $scope.goToNextInput = function(event, number) {
		   	 // //console.log(event.keyCode);
		   	 // //console.log(number);
		   	 var no_len = document.getElementById("index"+(number - 1) ).value;
		   	 // //console.log(no_len.toString().length);

		   	 // //console.log(document.getElementById("index"+(number - 1) ).value);
		   	


		   	 if(number == 1 && (event.keyCode == 91 || event.keyCode == 17) && no_len.toString().length == 6){
		   	 	// //console.log("MATCHINGS", );
		   	 	var thecode = Array.from(no_len.toString());
		   	 	for(var i=0; i<6; i++){
		   	 		$scope.formcode.push(parseInt(thecode[i]));
		   	 	}

		   	 	document.getElementById("index5").focus();
		   	 	number =6;
		   		//return false;
		   	 } else {
		   	 		//event.keyCode
				   	if(event.keyCode == 37 && number > 0){
				   		document.getElementById("index"+(number - 2)).focus();
				   		return false;
				   	}
				   	if(event.keyCode == 39 && number < 6){
				   		document.getElementById("index"+(number)).focus();
				   		return false;
				   	}
				   	if(event.keyCode == 8 && number > 1 && document.getElementById("index"+(number - 1) ).value == ""){
				   		// //console.log("match");
				   		// //console.log("index"+(number - 2));
				   		document.getElementById("index"+(number - 2)).focus();
				   		return false;
				   	}
		   	 }


		   


		   	if(number == 6 && $scope.formcode.length == 6){
		   		var combine = $scope.formcode.join("");
		   		// //console.log("COMPLETE", combine);
		   		$scope.checkedcode++;
		   		// //console.log("tries", $scope.checkedcode);

		   		if($scope.checkedcode > 4){
		   			alert("Sorry - you have tried too many times, this code is now invalid and a new invitation will be sent to you.");

		   			//send another invitation code to the recipient 



		   			return false;
		   		} else {

		   			//let's send this out for verification!!
		   			UserService.GetPaxSecureInvite2($stateParams.token, combine)
	                .then(function (data) {
	                	// //console.log("GET SECURE INVITE", data);
	                	if(data.success){

	                		if(data.invitation.is_already_user){

	                			$scope.formData.user_id = data.invitation.user_id;
	                			$scope.formData.token = $stateParams.token;
	                			$scope.checked_identity = true;
	                			$state.go("passenger_signup_complete.your_profile");
	                		} else {

	                			
	                			alert("We couldn't match your invitation with our records - if you think you have an account, please go to the login screen and click the forgotten password link.");
	                			return false;
	                		}

	                		

	                	} else {
	                		alert(data.message);
	                		return false;
	                	}

	                });


		   		}


		   		return false;
		   	}


		    var entry = document.getElementById("index"+(number - 1) ).value;
		    if(entry > -1 && entry < 10 && entry !== ""){
		    	document.getElementById("index"+number).focus();
		    } else {
		    	document.getElementById("index"+(number - 1) ).value = "";
		    	document.getElementById("index"+(number - 1)).focus();
		    	return false;
		    }

		  }

		    $scope.submit_user_for_signup = function(){


		    	if($scope.formData.password !== $scope.formData.password2 || $scope.formData.password.length < 8){
		    		alert("Please ensure your password is at least 8 character and both of these match");
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
                		alert(data.message);
                		return false;
                	}

                });


		    	


			}





}






