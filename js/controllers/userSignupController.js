 app.controller('UserSignupController', UserSignupController);

    UserSignupController.$inject = ['UserService', '$http', '$rootScope', '$location', '$scope', '$state', '$stateParams', 'ToastService'];
    function UserSignupController(UserService, $http, $rootScope, $location, $scope, $state, $stateParams, ToastService) {
        	
    		
    		//automatically sort stuff out! :)
    		if($state.params.verify){
    			// //console.log("SEND VERIFICATION");
    			UserService.Verify($state.params.user_id, $state.params.verify)
                .then(function (data) {
	    			// //console.log("SENT VERIFICATION");
                	// //console.log(data);
                    if(data.success){
                    	$state.go("verified");
                    } else {
                    	ToastService.error('Error', data.message);
                    	$state.go("login");
                    }
                });
    		}



	    	// //console.log("HELLO");
		    ////console.log($scope.membership);

         	// we will store all of our form data in this object
		    

         	$scope.clubs = { clubs: [
			    	{
			    		id: 1,
			    		title: "Alouette Flying Club"
			    	},
			    	{
			    		id: 2,
			    		title: "EFG Flying Club"
			    	},
			    	{
			    		id: 3,
			    		title: "Surrey & Kent Flying Club"
			    	},
			    	{
			    		id: 4,
			    		title: "Arrow Flight Club"
			    	},
			    	{
			    		id: 5,
			    		title: "Cirrus Flying Club"
			    	}
		    	]		    	
		    };


		    $scope.memberships = { memberships: [
			    	{
			    		id: 1,
			    		title: "honory membership"
			    	},
			    	{
			    		id: 2,
			    		title: "day membership"
			    	},
			    	{
			    		id: 3,
			    		title: "social membership"
			    	},
			    	{
			    		id: 4,
			    		title: "full flying membership"
			    	},
			    	{
			    		id: 5,
			    		title: "temporary flying membership"
			    	}
		    	]		    	
		    };

		    $scope.state = { state: [
			    	{
			    		id: 2,
			    		title: "France"
			    	},
			    	{
			    		id: 3,
			    		title: "Netherlands"
			    	},
			    	{
			    		id: 4,
			    		title: "Germany"
			    	},
			    	{
			    		id: 5,
			    		title: "Spain"
			    	}
		    	]		    	
		    };

		    $scope.licenses = { licenses: [
			    	{
			    		id: 1,
			    		title: "EASA PPL"
			    	},
			    	{
			    		id: 2,
			    		title: "EASA CPL"
			    	},
			    	{
			    		id: 3,
			    		title: "EASA ATPL"
			    	},
			    	{
			    		id: 4,
			    		title: "UK NPPL"
			    	},
			    	{
			    		id: 5,
			    		title: "FAA SPL"
			    	}
		    	]		    	
		    };

		    $scope.medicals = { medicals: [
			    	{
			    		id: 1,
			    		title: "EASA MEDICAL"
			    	},
			    	{
			    		id: 2,
			    		title: "UK MEDICAL EXAMINATION"
			    	},
			    	{
			    		id: 3,
			    		title: "FAA MEDICAL"
			    	},
			    	{
			    		id: 4,
			    		title: "NZ CAA MEDICAL"
			    	},
			    	{
			    		id: 5,
			    		title: "FAA SPL MEDICAL"
			    	}
		    	]		    	
		    };

		    $scope.person = {};

		    $scope.person.selectedSingle = 'Samantha';
		  	$scope.person.selectedSingleKey = '5';

		  	$scope.people = [
			    { name: 'Adam',      email: 'adam@email.com',      age: 12, country: 'United States' },
			    { name: 'Amalie',    email: 'amalie@email.com',    age: 12, country: 'Argentina' },
			    { name: 'EstefanÃ­a', email: 'estefania@email.com', age: 21, country: 'Argentina' },
			    { name: 'Adrian',    email: 'adrian@email.com',    age: 21, country: 'Ecuador' },
			    { name: 'Wladimir',  email: 'wladimir@email.com',  age: 30, country: 'Ecuador' },
			    { name: 'Samantha',  email: 'samantha@email.com',  age: 30, country: 'United States' },
			    { name: 'Nicole',    email: 'nicole@email.com',    age: 43, country: 'Colombia' },
			    { name: 'Natasha',   email: 'natasha@email.com',   age: 54, country: 'Ecuador' },
			    { name: 'Michael',   email: 'michael@email.com',   age: 15, country: 'Colombia' },
			    { name: 'NicolÃ¡s',   email: 'nicolas@email.com',    age: 43, country: 'Colombia' }
		  	];





		    $scope.ratings = { ratings: [
			    	
					{
			    		id: 1,
			    		title: "SEP (land)"
			    	},
			    	{
			    		id: 2,
			    		title: "SEP (sea)"
			    	},
			    	{
			    		id: 3,
			    		title: "MEP (land)"
			    	},
			    	{
			    		id: 4,
			    		title: "MEP (sea)"
			    	},
			    	{
			    		id: 1,
			    		title: "Night Rating"
			    	},
			    	{
			    		id: 2,
			    		title: "Instrument Rating Restricted IR(r)"
			    	},
			    	{
			    		id: 3,
			    		title: "Instrument Rating"
			    	},
			    	{
			    		id: 4,
			    		title: "Aerobatics Rating"
			    	},
			    	{
			    		id: 5,
			    		title: "High Performance Aircraft Rating"
			    	}
		    	]		    	
		    };

		    $scope.differences = { differences: [
			    	{
			    		id: 1,
			    		title: "Variable Pitch"
			    	},
			    	{
			    		id: 2,
			    		title: "Retractable Gear"
			    	},
			    	{
			    		id: 3,
			    		title: "Turbo Differences Training"
			    	},
			    	{
			    		id: 4,
			    		title: "EFIS Differences Training"
			    	}
		    	]		    	
		    };


		    //may need to alter this one to reflect most common one depending on
		    //the license type
		    $scope.formData = {
		    	license: {
		    		differences: [],
		    		ratings: [$scope.ratings.ratings[0]],
		    		add_to: {
			    	}
		    	},
		    	medical: {}
		    	
		    };

		    $scope.add_element = function(bit_type){

		    	//remove from first array
		    	$scope[bit_type][bit_type] = $.grep($scope[bit_type][bit_type], function(e){ 
					return e.id != $scope.formData.license.add_to[bit_type].id; 
				});

		    	if(bit_type == "differences"){
		    		$scope.formData.license.add_to[bit_type].day = true;
		    		$scope.formData.license.add_to[bit_type].vfr = true;
		    	}
		    	//console.log($scope.formData.license.add_to[bit_type]);

		    	$scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);
		    	
		    	//clean the array to show what we want to show :)
		    	delete $scope.formData.license.add_to[bit_type];

		    }


		    $scope.remove_element = function(bit_type, index){

		 
 				//add to dropdown
				$scope[bit_type][bit_type].push($scope.formData.license[bit_type][index]);

		    
				$scope.formData.license[bit_type].splice(index,1)

		    	$scope.formData.license[bit_type] = $scope.formData.license[bit_type].filter(Boolean);
		    	//console.log($scope.formData.license[bit_type]);
		    	//$scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);

		    }

		    
		    $scope.checkValid = function(uisref){
		    	if(!uisref || uisref == ""){
		    		//console.log("here");
		    		uisref = $(".btn-info").attr("one-ui-sref");
		    	}


		    	//let's check the passwords match first...
	            if($scope.formData.user.password !== $scope.formData.user.password2){
	              $("input[type='password']").removeClass("ng-pristine").addClass("ng-invalid");
	              ToastService.warning('Password Mismatch', 'Your passwords do not match');
	              return false;
	            }

	            //check the password length > 8 characters
	            var strongPassword = new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})')
	            if(strongPassword.test($scope.formData.user.password)) {
	              //console.log("password strength OK");
	            } else {
	              $("input[type='password']").removeClass("ng-pristine").addClass("ng-invalid");
	              ToastService.warning('Weak Password', 'Your password must be at least 8 characters in length, contain 1 uppercase, 1 lowercase, 1 number, and 1 special character');
	              return false;
	            }



		    	//console.log($('#signup-form')[0].checkValidity());
		    	if(! $('#signup-form')[0].checkValidity()){
		    		$(".ng-pristine").not(".ng-valid").removeClass("ng-pristine").addClass("ng-invalid");
		    		$("input:checkbox:not(:checked):required").addClass("ng-checkbox-unchecked");
		    		//console.log("STOP");
		    		return false;
		    	} else {

		    		//console.log("HERE");
		    		
		    		if(!$scope.formData.user){
		    			//console.log("missing first bit...");
				    	$state.go("user_signup.your_details");
		    			return false;
		    		}
		    		if(!$scope.formData.user.nok){
		    			//console.log("missing second bit...");
				    	$state.go("user_signup.next_of_kin");
		    			return false;
		    		}
		    		if(!$scope.formData.club){
		    			//console.log("missing second bit...");
				    	$state.go("user_signup.your_club");
		    			return false;
		    		}
		    		if(!$scope.formData.tnc){
			    		$("input:checkbox:not(:checked)").addClass("ng-checkbox-unchecked");
		    		} else {
		    			$("input:checkbox:not(:checked)").removeClass("ng-checkbox-unchecked");
		    		}
		    		if($scope.formData.user.password == $scope.formData.user.password2){
			    		var next = uisref;
			    		if(next == "verify_account"){
			    			//console.log("verifying account");
			    			$scope.processForm();
			    		} else {
				    		$state.go(next);
			    		}
		    		} else {
			    		$("input[type='password']").removeClass("ng-pristine").addClass("ng-invalid");
		    			return false;
		    		}

		    		// if(!$scope.formData.user){
				    // 		$state.go("user_signup.your_details");
		    		// }
		    		// if($scope.formData.user.password == $scope.formData.user.password2){
		    		// 	//console.log(uisref);
			    	// 	$state.go(uisref);
		    		// } else {
			    	// 	$("input[type='password']").removeClass("ng-pristine").addClass("ng-invalid");
		    		// 	return false;
		    		// }
		    	}
		    }


		    // function to process the form
		    $scope.processForm = function() {
		         if ($scope.formData.$valid) {
	                ToastService.success('Form Valid', 'Your form is valid.');
	            } 
		    };






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

    }