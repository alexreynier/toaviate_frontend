 app.controller('InvitationsSignupController', InvitationsSignupController);

    InvitationsSignupController.$inject = ['UserService', 'MemberService', 'GoCardService', '$http', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$cookies', '$log', 'ToastService', 'PaymentService', 'EnvConfig', 'SignupDraftService', 'SignupPreviewService', 'PasswordPolicyService', 'AuthenticationService'];
    function InvitationsSignupController(UserService, MemberService, GoCardService, $http, $rootScope, $location, $scope, $state, $stateParams, $cookies, $log, ToastService, PaymentService, EnvConfig, SignupDraftService, SignupPreviewService, PasswordPolicyService, AuthenticationService, LogbookSignupService) {
        	
        	var vm = this;

        	$scope.formData = {};
        	$scope.invStep = 1;
        	$scope.invErrors = {};
        	$scope.invLoading = false;
        	$scope.invPaymentMethod = null;     // 'direct_debit' | 'stripe' | 'skip'
        	$scope.invShowStripeForm = false;
        	$scope.invPaymentResult = null;     // 'direct_debit' | 'stripe' | 'skipped'
        	$scope.invShowSkipConfirm = false;
        	var invStripeElements = null;        // Stripe Elements instance (kept in closure)

        	// ── The invitee's account ──
        	// Known once the signup response (or a resumed invitation) says so.
        	// Never a cookie: a stale `uid` cookie on a shared machine sent the
        	// SMS code — and would have attached the card — to the wrong person.
        	$scope.signup_uid = null;
        	$scope.account_created = false;   // from here on the wizard runs AS the account (logged in)
        	$scope.invResumed = false;        // came back to finish payment
        	$scope.invResumeLogin = false;    // account exists, but this browser isn't logged in as it
        	$scope.invAlreadyDone = false;    // this invitation was completed earlier
        	$scope.invPaymentError = '';
        	$scope.codeSent = false;
        	var PAYMENT_GATE_KEY = 'toaviate_payment_setup_required';
        	function loggedInUserId(){ var g = $rootScope.globals; return (g && g.currentUser && g.currentUser.id) ? Number(g.currentUser.id) : 0; }
        	function inviteeUid(){
        		if ($scope.signup_uid) { return $scope.signup_uid; }
        		var inv = $scope.all || {};
        		if (Number(inv.user_id) > 0) { return Number(inv.user_id); }   // BS conversion / merge: the account is known up front
        		return null;
        	}
        	$scope.loggedInAsInvitee = function(){ var u = inviteeUid(); return !!(u && loggedInUserId() === Number(u)); };
        	function clearPaymentGate(){ try { localStorage.removeItem(PAYMENT_GATE_KEY); } catch (e) {} }
        	// After the account is created: remember it, log it in (the payment
        	// step and the phone check run as this user), then carry on.
        	function afterAccountCreated(data, next){
        		if (data && data.uid) { $scope.signup_uid = Number(data.uid); }
        		else if (data && data.user && data.user.id) { $scope.signup_uid = Number(data.user.id); }
        		$scope.account_created = true;
        		SignupDraftService.Clear(DRAFT_KEY);
        		if (data && data.login && data.login.session && data.login.user) {
        			AuthenticationService.SetCredentials2($scope.formData.email, $scope.formData.password, data.login.user, data.login.session, function(){ next(); });
        			return;
        		}
        		next();
        	}

        	// ── Step tracking ──
        	$scope.setInvStep = function(n) {
        		$scope.invStep = n;
        	};

        	// ── Refresh / back-forward robustness ──────────────────────────
        	// The invitation itself is always re-fetched by token, but what
        	// the user *typed* (DOB, phone, next of kin…) used to die on a
        	// refresh, and the stepper ignored the browser's back/forward
        	// buttons. We auto-save a sanitised draft per invitation token
        	// (never passwords or T&C ticks), restore it after the invite
        	// loads, derive the stepper from the current state, and bounce
        	// deep links to steps whose prerequisites are missing.

        	var DRAFT_KEY = 'invitation_' + ($stateParams.token || 'unknown');

        	var STEP_BY_STATE = {
        		'invitations.introduction': 1,
        		'invitations.your_details': 2,
        		'invitations.next_of_kin':  3,
        		'invitations.your_club':    4,
        		'invitations.tnc':          4,
        		'invitations.direct_debit': 5,
        		'invitations.verified':     6
        	};

        	function syncStepFromState(stateName) {
        		if (STEP_BY_STATE[stateName]) {
        			$scope.invStep = STEP_BY_STATE[stateName];
        		}
        	}

        	// Steps 3-4 need the details step completed *this session*
        	// (we never store the password, so after a refresh the user is
        	// sent back to re-enter it — everything else is restored).
        	// Steps 5-6 run AFTER the account exists — never bounce those.
        	function guardStep(stateName) {
        		if (stateName !== 'invitations.next_of_kin' && stateName !== 'invitations.your_club' && stateName !== 'invitations.tnc') { return; }
        		if ($scope.account_created) { return; }   // resumed: the account exists, no password needed
        		if (!$scope.formData.password) {
        			ToastService.warning('Please Re-enter Your Password', 'For security we never store your password — your other details have been kept. Please choose your password again to continue.');
        			$state.go('invitations.your_details', { token: $stateParams.token }, { location: 'replace' });
        		}
        	}

        	function goToDefaultChild() {
        		// Landing on the bare /invitations/:token URL shows an empty
        		// card. Payment-provider redirects resume at the payment
        		// result; everyone else starts at the introduction.
        		if ($location.search().redirect_flow_id || $location.search().stripe_success || $location.search().setup_intent) {
        			$state.go('invitations.direct_debit', { token: $stateParams.token }, { location: 'replace' });
        		} else {
        			$state.go('invitations.introduction', { token: $stateParams.token }, { location: 'replace' });
        		}
        	}

        	// The guard needs to know whether the account already exists
        	// (signup_status from the invitation) — so on a cold load it runs
        	// once the invitation has been applied, not before.
        	var inviteLoaded = false;
        	if ($state.current.name === 'invitations') {
        		goToDefaultChild();
        	} else {
        		syncStepFromState($state.current.name);
        	}

        	$scope.$on('$stateChangeSuccess', function (event, toState) {
        		if (toState.name === 'invitations') {
        			goToDefaultChild();
        			return;
        		}
        		syncStepFromState(toState.name);
        		if (inviteLoaded) { guardStep(toState.name); }
        	});

        	// Read any existing draft NOW (synchronously) — the auto-save
        	// watcher below starts writing straight away, and we must not let
        	// it overwrite last session's draft before the (async) invitation
        	// fetch gets a chance to restore it.
        	var savedDraft = SignupDraftService.Load(DRAFT_KEY);

        	// Auto-save what the user types (debounced, sanitised).
        	SignupDraftService.Watch($scope, DRAFT_KEY, function () {
        		return { formData: $scope.formData, selected_phone: vm.selected_phone };
        	});

        	// ── Clear a single field error on user input ──
        	$scope.clearInvError = function(field) {
        		if ($scope.invErrors[field]) {
        			delete $scope.invErrors[field];
        		}
        	};

        	// Live password-requirements checklist under the password field.
        	$scope.pwCheck = PasswordPolicyService.Rules;


vm.selected_phone;

 vm.countries = [
 {
   "CountryCode": "+247",
   "CountryCodeISO": "SH",
   "Country": "Ascension"
 },
 {
   "CountryCode": "+246",
   "CountryCodeISO": "DG",
   "Country": "Diego Garcia"
 },
 {
   "CountryCode": "+291",
   "CountryCodeISO": "ER",
   "Country": "Eritrea"
 },
 {
   "CountryCode": "+500",
   "CountryCodeISO": "FK",
   "Country": "Falkland (Malvinas) Islands"
 },
 {
   "CountryCode": "+692",
   "CountryCodeISO": "MH",
   "Country": "Marshall Islands"
 },
 {
   "CountryCode": "+691",
   "CountryCodeISO": "FM",
   "Country": "Micronesia"
 },
 {
   "CountryCode": "+683",
   "CountryCodeISO": "NU",
   "Country": "Niue Island"
 },
 {
   "CountryCode": "+290",
   "CountryCodeISO": "SH",
   "Country": "Saint Helena"
 },
 {
   "CountryCode": "+508",
   "CountryCodeISO": "PM",
   "Country": "Saint Pierre and Miquelon"
 },
 {
   "CountryCode": "+690",
   "CountryCodeISO": "TK",
   "Country": "Tokelau"
 },
 {
   "CountryCode": "+688",
   "CountryCodeISO": "TV",
   "Country": "Tuvalu"
 },
 {
   "CountryCode": "+379",
   "CountryCodeISO": "VA",
   "Country": "Vatican City"
 },
 {
   "CountryCode": "+681",
   "CountryCodeISO": "WF",
   "Country": "Wallis and Futuna"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "AS",
   "Country": "American Samoa"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "CA",
   "Country": "Canada"
 },
 {
   "CountryCode": "+61",
   "CountryCodeISO": "AU",
   "Country": "Australia"
 },
 {
   "CountryCode": "+93",
   "CountryCodeISO": "AF",
   "Country": "Afghanistan"
 },
 {
   "CountryCode": "+355",
   "CountryCodeISO": "AL",
   "Country": "Albania"
 },
 {
   "CountryCode": "+213",
   "CountryCodeISO": "DZ",
   "Country": "Algeria"
 },
 {
   "CountryCode": "+376",
   "CountryCodeISO": "AD",
   "Country": "Andorra"
 },
 {
   "CountryCode": "+244",
   "CountryCodeISO": "AO",
   "Country": "Angola"
 },
 {
   "CountryCode": "+54",
   "CountryCodeISO": "AR",
   "Country": "Argentina"
 },
 {
   "CountryCode": "+374",
   "CountryCodeISO": "AM",
   "Country": "Armenia"
 },
 {
   "CountryCode": "+297",
   "CountryCodeISO": "AW",
   "Country": "Aruba"
 },
 {
   "CountryCode": "+43",
   "CountryCodeISO": "AT",
   "Country": "Austria"
 },
 {
   "CountryCode": "+994",
   "CountryCodeISO": "AZ",
   "Country": "Azerbaijan"
 },
 {
   "CountryCode": "+973",
   "CountryCodeISO": "BH",
   "Country": "Bahrain"
 },
 {
   "CountryCode": "+880",
   "CountryCodeISO": "BD",
   "Country": "Bangladesh"
 },
 {
   "CountryCode": "+375",
   "CountryCodeISO": "BY",
   "Country": "Belarus"
 },
 {
   "CountryCode": "+32",
   "CountryCodeISO": "BE",
   "Country": "Belgium"
 },
 {
   "CountryCode": "+501",
   "CountryCodeISO": "BZ",
   "Country": "Belize"
 },
 {
   "CountryCode": "+229",
   "CountryCodeISO": "BJ",
   "Country": "Benin"
 },
 {
   "CountryCode": "+975",
   "CountryCodeISO": "BT",
   "Country": "Bhutan"
 },
 {
   "CountryCode": "+591",
   "CountryCodeISO": "BO",
   "Country": "Bolivia"
 },
 {
   "CountryCode": "+387",
   "CountryCodeISO": "BA",
   "Country": "Bosnia and Herzegovina"
 },
 {
   "CountryCode": "+267",
   "CountryCodeISO": "BW",
   "Country": "Botswana"
 },
 {
   "CountryCode": "+55",
   "CountryCodeISO": "BR",
   "Country": "Brazil"
 },
 {
   "CountryCode": "+673",
   "CountryCodeISO": "BN",
   "Country": "Brunei"
 },
 {
   "CountryCode": "+359",
   "CountryCodeISO": "BG",
   "Country": "Bulgaria"
 },
 {
   "CountryCode": "+226",
   "CountryCodeISO": "BF",
   "Country": "Burkina Faso"
 },
 {
   "CountryCode": "+257",
   "CountryCodeISO": "BI",
   "Country": "Burundi"
 },
 {
   "CountryCode": "+855",
   "CountryCodeISO": "KH",
   "Country": "Cambodia"
 },
 {
   "CountryCode": "+237",
   "CountryCodeISO": "CM",
   "Country": "Cameroon"
 },
 {
   "CountryCode": "+238",
   "CountryCodeISO": "CV",
   "Country": "Cape Verde"
 },
 {
   "CountryCode": "+236",
   "CountryCodeISO": "CF",
   "Country": "Central African Republic"
 },
 {
   "CountryCode": "+235",
   "CountryCodeISO": "TD",
   "Country": "Chad"
 },
 {
   "CountryCode": "+56",
   "CountryCodeISO": "CL",
   "Country": "Chile"
 },
 {
   "CountryCode": "+86",
   "CountryCodeISO": "CN",
   "Country": "China"
 },
 {
   "CountryCode": "+57",
   "CountryCodeISO": "CO",
   "Country": "Colombia"
 },
 {
   "CountryCode": "+269",
   "CountryCodeISO": "KM",
   "Country": "Comoros"
 },
 {
   "CountryCode": "+242",
   "CountryCodeISO": "CG",
   "Country": "Congo"
 },
 {
   "CountryCode": "+682",
   "CountryCodeISO": "CK",
   "Country": "Cook Islands"
 },
 {
   "CountryCode": "+506",
   "CountryCodeISO": "CR",
   "Country": "Costa Rica"
 },
 {
   "CountryCode": "+385",
   "CountryCodeISO": "HR",
   "Country": "Croatia"
 },
 {
   "CountryCode": "+53",
   "CountryCodeISO": "CU",
   "Country": "Cuba"
 },
 {
   "CountryCode": "+357",
   "CountryCodeISO": "CY",
   "Country": "Cyprus"
 },
 {
   "CountryCode": "+420",
   "CountryCodeISO": "CZ",
   "Country": "Czech Republic"
 },
 {
   "CountryCode": "+243",
   "CountryCodeISO": "CD",
   "Country": "Democratic Republic of Congo"
 },
 {
   "CountryCode": "+45",
   "CountryCodeISO": "DK",
   "Country": "Denmark"
 },
 {
   "CountryCode": "+253",
   "CountryCodeISO": "DJ",
   "Country": "Djibouti"
 },
 {
   "CountryCode": "+670",
   "CountryCodeISO": "TL",
   "Country": "East Timor"
 },
 {
   "CountryCode": "+593",
   "CountryCodeISO": "EC",
   "Country": "Ecuador"
 },
 {
   "CountryCode": "+20",
   "CountryCodeISO": "EG",
   "Country": "Egypt"
 },
 {
   "CountryCode": "+503",
   "CountryCodeISO": "SV",
   "Country": "El Salvador"
 },
 {
   "CountryCode": "+240",
   "CountryCodeISO": "GQ",
   "Country": "Equatorial Guinea"
 },
 {
   "CountryCode": "+372",
   "CountryCodeISO": "EE",
   "Country": "Estonia"
 },
 {
   "CountryCode": "+251",
   "CountryCodeISO": "ET",
   "Country": "Ethiopia"
 },
 {
   "CountryCode": "+298",
   "CountryCodeISO": "FO",
   "Country": "Faroe Islands"
 },
 {
   "CountryCode": "+679",
   "CountryCodeISO": "FJ",
   "Country": "Fiji"
 },
 {
   "CountryCode": "+358",
   "CountryCodeISO": "FI",
   "Country": "Finland"
 },
 {
   "CountryCode": "+33",
   "CountryCodeISO": "FR",
   "Country": "France"
 },
 {
   "CountryCode": "+594",
   "CountryCodeISO": "GF",
   "Country": "French Guiana"
 },
 {
   "CountryCode": "+689",
   "CountryCodeISO": "PF",
   "Country": "French Polynesia"
 },
 {
   "CountryCode": "+241",
   "CountryCodeISO": "GA",
   "Country": "Gabon"
 },
 {
   "CountryCode": "+220",
   "CountryCodeISO": "GM",
   "Country": "Gambia"
 },
 {
   "CountryCode": "+995",
   "CountryCodeISO": "GE",
   "Country": "Georgia"
 },
 {
   "CountryCode": "+49",
   "CountryCodeISO": "DE",
   "Country": "Germany"
 },
 {
   "CountryCode": "+233",
   "CountryCodeISO": "GH",
   "Country": "Ghana"
 },
 {
   "CountryCode": "+350",
   "CountryCodeISO": "GI",
   "Country": "Gibraltar"
 },
 {
   "CountryCode": "+30",
   "CountryCodeISO": "GR",
   "Country": "Greece"
 },
 {
   "CountryCode": "+299",
   "CountryCodeISO": "GL",
   "Country": "Greenland"
 },
 {
   "CountryCode": "+590",
   "CountryCodeISO": "GP",
   "Country": "Guadeloupe"
 },
 {
   "CountryCode": "+502",
   "CountryCodeISO": "GT",
   "Country": "Guatemala"
 },
 {
   "CountryCode": "+224",
   "CountryCodeISO": "GN",
   "Country": "Guinea"
 },
 {
   "CountryCode": "+245",
   "CountryCodeISO": "GW",
   "Country": "Guinea-Bissau"
 },
 {
   "CountryCode": "+592",
   "CountryCodeISO": "GY",
   "Country": "Guyana"
 },
 {
   "CountryCode": "+509",
   "CountryCodeISO": "HT",
   "Country": "Haiti"
 },
 {
   "CountryCode": "+504",
   "CountryCodeISO": "HN",
   "Country": "Honduras"
 },
 {
   "CountryCode": "+852",
   "CountryCodeISO": "HK",
   "Country": "Hong Kong"
 },
 {
   "CountryCode": "+36",
   "CountryCodeISO": "HU",
   "Country": "Hungary"
 },
 {
   "CountryCode": "+354",
   "CountryCodeISO": "IS",
   "Country": "Iceland"
 },
 {
   "CountryCode": "+91",
   "CountryCodeISO": "IN",
   "Country": "India"
 },
 {
   "CountryCode": "+62",
   "CountryCodeISO": "ID",
   "Country": "Indonesia"
 },
 {
   "CountryCode": "+98",
   "CountryCodeISO": "IR",
   "Country": "Iran"
 },
 {
   "CountryCode": "+964",
   "CountryCodeISO": "IQ",
   "Country": "Iraq"
 },
 {
   "CountryCode": "+353",
   "CountryCodeISO": "IE",
   "Country": "Ireland"
 },
 {
   "CountryCode": "+972",
   "CountryCodeISO": "IL",
   "Country": "Israel"
 },
 {
   "CountryCode": "+39",
   "CountryCodeISO": "IT",
   "Country": "Italy"
 },
 {
   "CountryCode": "+225",
   "CountryCodeISO": "CI",
   "Country": "Ivory Coast"
 },
 {
   "CountryCode": "+81",
   "CountryCodeISO": "JP",
   "Country": "Japan"
 },
 {
   "CountryCode": "+962",
   "CountryCodeISO": "JO",
   "Country": "Jordan"
 },
 {
   "CountryCode": "+254",
   "CountryCodeISO": "KE",
   "Country": "Kenya"
 },
 {
   "CountryCode": "+686",
   "CountryCodeISO": "KI",
   "Country": "Kiribati"
 },
 {
   "CountryCode": "+965",
   "CountryCodeISO": "KW",
   "Country": "Kuwait"
 },
 {
   "CountryCode": "+996",
   "CountryCodeISO": "KG",
   "Country": "Kyrgyzstan"
 },
 {
   "CountryCode": "+856",
   "CountryCodeISO": "LA",
   "Country": "Laos"
 },
 {
   "CountryCode": "+371",
   "CountryCodeISO": "LV",
   "Country": "Latvia"
 },
 {
   "CountryCode": "+961",
   "CountryCodeISO": "LB",
   "Country": "Lebanon"
 },
 {
   "CountryCode": "+266",
   "CountryCodeISO": "LS",
   "Country": "Lesotho"
 },
 {
   "CountryCode": "+231",
   "CountryCodeISO": "LR",
   "Country": "Liberia"
 },
 {
   "CountryCode": "+218",
   "CountryCodeISO": "LY",
   "Country": "Libya"
 },
 {
   "CountryCode": "+423",
   "CountryCodeISO": "LI",
   "Country": "Liechtenstein"
 },
 {
   "CountryCode": "+370",
   "CountryCodeISO": "LT",
   "Country": "Lithuania"
 },
 {
   "CountryCode": "+352",
   "CountryCodeISO": "LU",
   "Country": "Luxembourg"
 },
 {
   "CountryCode": "+853",
   "CountryCodeISO": "MO",
   "Country": "Macau"
 },
 {
   "CountryCode": "+389",
   "CountryCodeISO": "MK",
   "Country": "Macedonia"
 },
 {
   "CountryCode": "+261",
   "CountryCodeISO": "MG",
   "Country": "Madagascar"
 },
 {
   "CountryCode": "+265",
   "CountryCodeISO": "MW",
   "Country": "Malawi"
 },
 {
   "CountryCode": "+60",
   "CountryCodeISO": "MY",
   "Country": "Malaysia"
 },
 {
   "CountryCode": "+960",
   "CountryCodeISO": "MV",
   "Country": "Maldives"
 },
 {
   "CountryCode": "+223",
   "CountryCodeISO": "ML",
   "Country": "Mali"
 },
 {
   "CountryCode": "+356",
   "CountryCodeISO": "MT",
   "Country": "Malta"
 },
 {
   "CountryCode": "+596",
   "CountryCodeISO": "MQ",
   "Country": "Martinique"
 },
 {
   "CountryCode": "+222",
   "CountryCodeISO": "MR",
   "Country": "Mauritania"
 },
 {
   "CountryCode": "+230",
   "CountryCodeISO": "MU",
   "Country": "Mauritius"
 },
 {
   "CountryCode": "+262",
   "CountryCodeISO": "RE",
   "Country": "Reunion"
 },
 {
   "CountryCode": "+52",
   "CountryCodeISO": "MX",
   "Country": "Mexico"
 },
 {
   "CountryCode": "+373",
   "CountryCodeISO": "MD",
   "Country": "Moldova"
 },
 {
   "CountryCode": "+377",
   "CountryCodeISO": "MC",
   "Country": "Monaco"
 },
 {
   "CountryCode": "+976",
   "CountryCodeISO": "MN",
   "Country": "Mongolia"
 },
 {
   "CountryCode": "+382",
   "CountryCodeISO": "ME",
   "Country": "Montenegro"
 },
 {
   "CountryCode": "+212",
   "CountryCodeISO": "MA",
   "Country": "Morocco"
 },
 {
   "CountryCode": "+258",
   "CountryCodeISO": "MZ",
   "Country": "Mozambique"
 },
 {
   "CountryCode": "+95",
   "CountryCodeISO": "MM",
   "Country": "Myanmar"
 },
 {
   "CountryCode": "+264",
   "CountryCodeISO": "NA",
   "Country": "Namibia"
 },
 {
   "CountryCode": "+674",
   "CountryCodeISO": "NR",
   "Country": "Nauru"
 },
 {
   "CountryCode": "+977",
   "CountryCodeISO": "NP",
   "Country": "Nepal"
 },
 {
   "CountryCode": "+31",
   "CountryCodeISO": "NL",
   "Country": "Netherlands"
 },
 {
   "CountryCode": "+599",
   "CountryCodeISO": "AN",
   "Country": "Netherlands Antilles"
 },
 {
   "CountryCode": "+687",
   "CountryCodeISO": "NC",
   "Country": "New Caledonia"
 },
 {
   "CountryCode": "+64",
   "CountryCodeISO": "NZ",
   "Country": "New Zealand"
 },
 {
   "CountryCode": "+505",
   "CountryCodeISO": "NI",
   "Country": "Nicaragua"
 },
 {
   "CountryCode": "+227",
   "CountryCodeISO": "NE",
   "Country": "Niger"
 },
 {
   "CountryCode": "+234",
   "CountryCodeISO": "NG",
   "Country": "Nigeria"
 },
 {
   "CountryCode": "+850",
   "CountryCodeISO": "KP",
   "Country": "North Korea"
 },
 {
   "CountryCode": "+47",
   "CountryCodeISO": "NO",
   "Country": "Norway"
 },
 {
   "CountryCode": "+968",
   "CountryCodeISO": "OM",
   "Country": "Oman"
 },
 {
   "CountryCode": "+92",
   "CountryCodeISO": "PK",
   "Country": "Pakistan"
 },
 {
   "CountryCode": "+680",
   "CountryCodeISO": "PW",
   "Country": "Palau"
 },
 {
   "CountryCode": "+507",
   "CountryCodeISO": "PA",
   "Country": "Panama"
 },
 {
   "CountryCode": "+675",
   "CountryCodeISO": "PG",
   "Country": "Papua New Guinea"
 },
 {
   "CountryCode": "+595",
   "CountryCodeISO": "PY",
   "Country": "Paraguay"
 },
 {
   "CountryCode": "+51",
   "CountryCodeISO": "PE",
   "Country": "Peru"
 },
 {
   "CountryCode": "+63",
   "CountryCodeISO": "PH",
   "Country": "Philippines"
 },
 {
   "CountryCode": "+48",
   "CountryCodeISO": "PL",
   "Country": "Poland"
 },
 {
   "CountryCode": "+351",
   "CountryCodeISO": "PT",
   "Country": "Portugal"
 },
 {
   "CountryCode": "+974",
   "CountryCodeISO": "QA",
   "Country": "Qatar"
 },
 {
   "CountryCode": "+40",
   "CountryCodeISO": "RO",
   "Country": "Romania"
 },
 {
   "CountryCode": "+7",
   "CountryCodeISO": "KZ",
   "Country": "Kazakhstan"
 },
 {
   "CountryCode": "+250",
   "CountryCodeISO": "RW",
   "Country": "Rwanda"
 },
 {
   "CountryCode": "+685",
   "CountryCodeISO": "WS",
   "Country": "Samoa"
 },
 {
   "CountryCode": "+378",
   "CountryCodeISO": "SM",
   "Country": "San Marino"
 },
 {
   "CountryCode": "+239",
   "CountryCodeISO": "ST",
   "Country": "Sao Tome and Principe"
 },
 {
   "CountryCode": "+966",
   "CountryCodeISO": "SA",
   "Country": "Saudi Arabia"
 },
 {
   "CountryCode": "+221",
   "CountryCodeISO": "SN",
   "Country": "Senegal"
 },
 {
   "CountryCode": "+381",
   "CountryCodeISO": "RS",
   "Country": "Serbia"
 },
 {
   "CountryCode": "+248",
   "CountryCodeISO": "SC",
   "Country": "Seychelles"
 },
 {
   "CountryCode": "+232",
   "CountryCodeISO": "SL",
   "Country": "Sierra Leone"
 },
 {
   "CountryCode": "+65",
   "CountryCodeISO": "SG",
   "Country": "Singapore"
 },
 {
   "CountryCode": "+421",
   "CountryCodeISO": "SK",
   "Country": "Slovakia"
 },
 {
   "CountryCode": "+386",
   "CountryCodeISO": "SI",
   "Country": "Slovenia"
 },
 {
   "CountryCode": "+677",
   "CountryCodeISO": "SB",
   "Country": "Solomon Islands"
 },
 {
   "CountryCode": "+252",
   "CountryCodeISO": "SO",
   "Country": "Somalia"
 },
 {
   "CountryCode": "+27",
   "CountryCodeISO": "ZA",
   "Country": "South Africa"
 },
 {
   "CountryCode": "+82",
   "CountryCodeISO": "KR",
   "Country": "South Korea"
 },
 {
   "CountryCode": "+34",
   "CountryCodeISO": "ES",
   "Country": "Spain"
 },
 {
   "CountryCode": "+94",
   "CountryCodeISO": "LK",
   "Country": "Sri Lanka"
 },
 {
   "CountryCode": "+249",
   "CountryCodeISO": "SD",
   "Country": "Sudan"
 },
 {
   "CountryCode": "+597",
   "CountryCodeISO": "SR",
   "Country": "Suriname"
 },
 {
   "CountryCode": "+268",
   "CountryCodeISO": "SZ",
   "Country": "Swaziland"
 },
 {
   "CountryCode": "+46",
   "CountryCodeISO": "SE",
   "Country": "Sweden"
 },
 {
   "CountryCode": "+41",
   "CountryCodeISO": "CH",
   "Country": "Switzerland"
 },
 {
   "CountryCode": "+963",
   "CountryCodeISO": "SY",
   "Country": "Syria"
 },
 {
   "CountryCode": "+886",
   "CountryCodeISO": "TW",
   "Country": "Taiwan"
 },
 {
   "CountryCode": "+992",
   "CountryCodeISO": "TJ",
   "Country": "Tajikistan"
 },
 {
   "CountryCode": "+255",
   "CountryCodeISO": "TZ",
   "Country": "Tanzania"
 },
 {
   "CountryCode": "+66",
   "CountryCodeISO": "TH",
   "Country": "Thailand"
 },
 {
   "CountryCode": "+228",
   "CountryCodeISO": "TG",
   "Country": "Togo"
 },
 {
   "CountryCode": "+216",
   "CountryCodeISO": "TN",
   "Country": "Tunisia"
 },
 {
   "CountryCode": "+90",
   "CountryCodeISO": "TR",
   "Country": "Turkey"
 },
 {
   "CountryCode": "+993",
   "CountryCodeISO": "TM",
   "Country": "Turkmenistan"
 },
 {
   "CountryCode": "+256",
   "CountryCodeISO": "UG",
   "Country": "Uganda"
 },
 {
   "CountryCode": "+380",
   "CountryCodeISO": "UA",
   "Country": "Ukraine"
 },
 {
   "CountryCode": "+971",
   "CountryCodeISO": "AE",
   "Country": "United Arab Emirates"
 },
 {
   "CountryCode": "+44",
   "CountryCodeISO": "GB",
   "Country": "United Kingdom"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "VI",
   "Country": "U.S. Virgin Islands"
 },
 {
   "CountryCode": "+598",
   "CountryCodeISO": "UY",
   "Country": "Uruguay"
 },
 {
   "CountryCode": "+998",
   "CountryCodeISO": "UZ",
   "Country": "Uzbekistan"
 },
 {
   "CountryCode": "+678",
   "CountryCodeISO": "VU",
   "Country": "Vanuatu"
 },
 {
   "CountryCode": "+58",
   "CountryCodeISO": "VE",
   "Country": "Venezuela"
 },
 {
   "CountryCode": "+84",
   "CountryCodeISO": "VN",
   "Country": "Vietnam"
 },
 {
   "CountryCode": "+967",
   "CountryCodeISO": "YE",
   "Country": "Yemen"
 },
 {
   "CountryCode": "+260",
   "CountryCodeISO": "ZM",
   "Country": "Zambia"
 },
 {
   "CountryCode": "+263",
   "CountryCodeISO": "ZW",
   "Country": "Zimbabwe"
 },
 {
   "CountryCode": "+262",
   "CountryCodeISO": "YT",
   "Country": "Mayotte"
 },
 {
   "CountryCode": "+7",
   "CountryCodeISO": "RU",
   "Country": "Russian Federation"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "AI",
   "Country": "Anguilla"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "AG",
   "Country": "Antigua and Barbuda"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "BS",
   "Country": "Bahamas"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "BB",
   "Country": "Barbados"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "BM",
   "Country": "Bermuda"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "VG",
   "Country": "British Virgin Islands"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "KY",
   "Country": "Cayman Islands"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "DM",
   "Country": "Dominica"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "DO",
   "Country": "Dominican Republic"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "GD",
   "Country": "Grenada"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "GU",
   "Country": "Guam"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "JM",
   "Country": "Jamaica"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "MS",
   "Country": "Montserrat"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "MP",
   "Country": "Northern Marianas"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "PR",
   "Country": "Puerto Rico"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "KN",
   "Country": "Saint Kitts and Nevis"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "LC",
   "Country": "Saint Lucia"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "VC",
   "Country": "Saint Vincent and the Grenadines"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "TT",
   "Country": "Trinidad and Tobago"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "TC",
   "Country": "Turks and Caicos Islands"
 },
 {
   "CountryCode": "+676",
   "CountryCodeISO": "TO",
   "Country": "Tonga"
 },
 {
   "CountryCode": "+1",
   "CountryCodeISO": "US",
   "Country": "United States of America"
 },
 {
   "CountryCode": "+970",
   "CountryCodeISO": "PS",
   "Country": "Palestine"
 },
 {
   "CountryCode": "+211",
   "CountryCodeISO": "SS",
   "Country": "South Sudan"
 },
 {
   "CountryCode": "+44",
   "CountryCodeISO": "IM",
   "Country": "Isle of Man"
 }
];

				
				




    		
    		// (The phone code is sent from the payment-result page's button, never
    		// on page load — reloading /verified used to re-send an SMS.)

    		// Apply an invitation payload (real or design-preview) to the scope.
    		function applyInvite(data){

                    	$scope.total_invite = data;
                    	
                    	$scope.formData.first_name = data.first_name;
		    			$scope.formData.last_name = data.last_name;
		    			$scope.formData.email = data.email;
		    			$scope.formData.membership_id = data.membership_id;
		    			$scope.formData.club_id = data.club_id;
		    			$scope.formData.to_pay = data.to_pay;
		    			$scope.formData.token = data.invitation_token;

		    			//maybe?
		    			$scope.formData.invited_by = data.invited_by;


		    			//$cookies.set("rid", data.membership.request.membership_request_id);
		    			//other data::
		    			$scope.payment_now = data.payment_now;
		    			$scope.first_payment = data.first_payment;
		    			$scope.club = data.club;
		    			$scope.membership = data.membership;

		    			$scope.all = data;

		    			// ── Resume ──
		    			// completed: nothing to do but log in. account_created: the
		    			// account exists but payment never finished — straight to the
		    			// payment step when this browser is logged in as that account,
		    			// otherwise ask for a login (the login gate brings them back).
		    			if (data.signup_status === 'completed') {
		    				$scope.invAlreadyDone = true;
		    				clearPaymentGate();
		    			} else if (data.signup_status === 'pending' && Number(data.bs_merge) === 1 && Number(data.user_id) > 0) {
		    				// BookedScheduler "merge into existing account": the person
		    				// already has a ToAviate account — nothing to retype. Logged in
		    				// as it: accept now (bookings + logbook fold in) and go straight
		    				// to the payment step if a fee is due. Otherwise: log in to accept.
		    				$scope.invMerge = true;
		    				if (loggedInUserId() === Number(data.user_id)) {
		    					acceptMergeAsLoggedIn(data);
		    				} else {
		    					try { localStorage.setItem('toaviate_accept_invitation', $stateParams.token); } catch (e) {}
		    					$scope.invite_existing_account = true;
		    				}
		    			} else if (data.signup_status === 'account_created' && Number(data.user_id) > 0) {
		    				if (loggedInUserId() === Number(data.user_id)) {
		    					$scope.signup_uid = Number(data.user_id);
		    					$scope.account_created = true;
		    					$scope.invResumed = true;
		    					if (!$location.search().redirect_flow_id && !$location.search().setup_intent && !$location.search().stripe_success) {
		    						$scope.invStep = 4;
		    						$state.go('invitations.your_club', { token: $stateParams.token }, { location: 'replace' });
		    					}
		    				} else {
		    					$scope.invResumeLogin = true;
		    				}
		    			}
		    			if ($scope.pendingSetupIntent) {
		    				var psi = $scope.pendingSetupIntent; $scope.pendingSetupIntent = null;
		    				confirmCardSetup(psi);
		    			}
		    			// now the guard knows whether an account exists
		    			inviteLoaded = true;
		    			if ($state.current.name !== 'invitations') { guardStep($state.current.name); }

		    			// Restore anything the user had already typed on this
		    			// device (draft never contains passwords / T&C ticks).
		    			// User-edited values win over the invite's prefill, but
		    			// the invitation itself stays authoritative for the
		    			// club / membership / token fields.
		    			var draft = savedDraft;
		    			if (draft && draft.formData) {
		    				angular.extend($scope.formData, draft.formData);
		    				$scope.formData.membership_id = data.membership_id;
		    				$scope.formData.club_id = data.club_id;
		    				$scope.formData.to_pay = data.to_pay;
		    				$scope.formData.token = data.invitation_token;
		    				$scope.formData.invited_by = data.invited_by;
		    				if (draft.selected_phone) { vm.selected_phone = draft.selected_phone; }
		    				// Dates come back from JSON as ISO strings — revive for the date input.
		    				if (typeof $scope.formData.dob === 'string') { $scope.formData.dob = new Date($scope.formData.dob); }
		    				if (draft.formData.dob || draft.formData.phone_number || (draft.formData.nok && draft.formData.nok.first_name)) {
		    					ToastService.success('Progress Restored', 'Welcome back — we saved what you had entered so far.');
		    				}
		    			}

    		}

    		function inviteLoadFailed(){
    			// Stay on the invitation page — do NOT redirect to login.
    			$scope.invite_load_failed = true;
    			ToastService.error('Invitation Not Found', 'Sorry we were unable to load this invitation. It may have expired, or the link may be incomplete. Please try clicking the link again, or ask your club to re-send it.');
    		}

    		// Design preview: tokens starting with "preview" load sample data
    		// and simulate every submit locally (non-production builds only).
    		var isPreview = SignupPreviewService.IsPreview($stateParams.token);

    		if(isPreview){

    			applyInvite(SignupPreviewService.GetInvitation($stateParams.token));
    			ToastService.warning('Design Preview', 'Sample invitation data — submits are simulated, nothing is saved.');

    		} else if($stateParams.token){

    			UserService.GetInvite($stateParams.token)
                .then(function (data) {
	    			////console.log("GETTING TOKEN", data);

                    // A real invitation payload is a truthy object that ISN'T the
                    // service's error shape ({success:false}). On any error we
                    // stay on this public page and show a message — we must NOT
                    // bounce the (usually logged-out) recipient to /login.
                    if(data && data.success !== false){
                    	applyInvite(data);
                    } else {
                    	inviteLoadFailed();
                    }
                });

    		} else {
    			// No token in the URL — this isn't a valid invitation link.
    			$scope.invite_load_failed = true;
    			ToastService.error('Invalid Invitation Link', 'This invitation link is missing its access token. Please use the full link from your invitation email.');
    		}
	    
		    // ── Payment-provider returns ──
		    // GoCardless comes back with ?redirect_flow_id: complete the mandate
		    // (the request is matched by flow id / token server-side) and only
		    // THEN show success. Stripe comes back with ?setup_intent&redirect_status:
		    // confirm the SetupIntent as the logged-in account — that is what
		    // creates the membership (Cards::confirm_setup → complete_stripe_signup).
		    if ($location.search().redirect_flow_id) {
		    	$scope.invStep = 5;
		    	$scope.invPaymentResult = 'pending';
		    	GoCardService.SetupMandate({
		    		mandate: $location.search().redirect_flow_id,
		    		session: $cookies.get("gcl_session") || "",
		    		token: $stateParams.token,
		    		member_accepted: true
		    	}).then(function (data) {
		    		if (data && data.success) {
		    			$scope.invPaymentResult = 'direct_debit';
		    			$cookies.remove("gcl_session");
		    			clearPaymentGate();
		    		} else {
		    			$scope.invPaymentResult = 'failed';
		    			$scope.invPaymentError = (data && data.message) || "The Direct Debit could not be completed.";
		    		}
		    	});
		    }
		    if ($location.search().setup_intent || $location.search().stripe_success) {
		    	$scope.invStep = 5;
		    	var redirectStatus = $location.search().redirect_status;
		    	if (redirectStatus && redirectStatus !== 'succeeded') {
		    		$scope.invPaymentResult = 'failed';
		    		$scope.invPaymentError = "Your card wasn't saved - your bank didn't authorise it. Please try again.";
		    	} else if ($location.search().setup_intent) {
		    		$scope.invPaymentResult = 'pending';
		    		$scope.pendingSetupIntent = $location.search().setup_intent;   // confirmed once the invitation (club, account) has loaded
		    	} else {
		    		$scope.invPaymentResult = 'stripe';
		    	}
		    }
		    function confirmCardSetup(setupIntentId){
		    	PaymentService.ConfirmSetup({
		    		setup_intent_id: setupIntentId,
		    		user_id: inviteeUid() || loggedInUserId(),
		    		club_id: ($scope.all && $scope.all.club_id) || $scope.formData.club_id
		    	}).then(function (data) {
		    		if (data && data.success) {
		    			$scope.invPaymentResult = 'stripe';
		    			clearPaymentGate();
		    		} else {
		    			$scope.invPaymentResult = 'failed';
		    			$scope.invPaymentError = (data && (data.message || data.error)) || "We couldn't confirm your card. Please try again.";
		    		}
		    	});
		    }
		    // Payment failed or was abandoned: back to the payment step (the
		    // account already exists, so this is just choosing how to pay).
		    $scope.retryPayment = function(){
		    	$scope.invPaymentResult = null;
		    	$scope.invPaymentError = '';
		    	$scope.invPaymentMethod = null;
		    	$scope.invStep = 4;
		    	$state.go('invitations.your_club');
		    };


		    //may need to alter this one to reflect most common one depending on
		    //the license type
		    

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

		    $scope.downloadClubDocument = function(doc) {
	            // Club T&C links call this with no argument — resolve the
	            // club's own terms document from the invitation payload.
	            if (!doc) {
	                doc = ($scope.club && ($scope.club.membership_terms || ($scope.club.settings && $scope.club.settings.membership_terms))) || null;
	            }
	            if (!doc) {
	                ToastService.warning('Document Unavailable', "The club hasn't uploaded its terms & conditions document yet — please ask the club for a copy.");
	                return;
	            }

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


		    $scope.remove_element = function(bit_type, index){

		 
 				//add to dropdown
				$scope[bit_type][bit_type].push($scope.formData.license[bit_type][index]);

		    
				$scope.formData.license[bit_type].splice(index,1)

		    	$scope.formData.license[bit_type] = $scope.formData.license[bit_type].filter(Boolean);
		    	//console.log($scope.formData.license[bit_type]);
		    	//$scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);

		    }



		    // Compose a full E.164 number (+ then digits only) from the selected
		    // country prefix and the national number as typed: strip spaces and
		    // other separators, drop the leading zero(s) of the national part.
		    // Agreed backend contract — see BACKEND_SIGNUP_ROBUSTNESS_GUIDE.md Task 8.
		    function e164Phone(prefix, national) {
		    	var raw = String(national || '').trim();
		    	if (raw.charAt(0) === '+') {
		    		// already typed as international — just sanitise
		    		return '+' + raw.replace(/\D/g, '');
		    	}
		    	var digits = raw.replace(/\D/g, '').replace(/^0+/, '');
		    	return String(prefix || '') + digits;
		    }

		    function check_user_is_valid(){
		    	if($scope.account_created){ return true; }

		    	if(		!$scope.formData.first_name
		    		|| !$scope.formData.last_name
		    		|| !$scope.formData.email
		    		|| !$scope.formData.dob
		    		|| !$scope.formData.password
		    		|| !$scope.formData.password2){
		    		ToastService.warning('Missing Fields', 'All form fields are required.');

		    		//not all fields are filled in
		    		return false;
		    	}

		    	if(!$scope.formData.phone_number || !String($scope.formData.phone_number).trim()){
		    		ToastService.warning('Mobile Number Required', 'Please enter your mobile number.');
		    		return false;
		    	}

		    	if(!vm.selected_phone || !vm.selected_phone.CountryCode){
		    		ToastService.warning('Country Code Required', 'Please select the country prefix for your mobile number from the drop-down.');
		    		return false;
		    	}

		    	var pwMessage = PasswordPolicyService.Message($scope.formData.password);
		    	if(pwMessage){
		    		ToastService.warning('Password Not Strong Enough', pwMessage);
		    		return false;
		    	}

		    	if($scope.formData.password !== $scope.formData.password2){
		    		//passwords do not match
		    		ToastService.warning('Passwords Don\'t Match', 'Your two passwords are different — please re-type the confirmation.');
		    		return false;
		    	}

		    	return true;
		    }
		    

		    // ══════════════════════════════════════════════
		    //  Per-step validation (used by new templates)
		    // ══════════════════════════════════════════════

		    $scope.validateDetails = function() {
		    	$scope.invErrors = {};
		    	var valid = true;

		    	if (!$scope.formData.first_name || !$scope.formData.first_name.trim()) {
		    		$scope.invErrors.first_name = true; valid = false;
		    	}
		    	if (!$scope.formData.last_name || !$scope.formData.last_name.trim()) {
		    		$scope.invErrors.last_name = true; valid = false;
		    	}
		    	if (!$scope.formData.dob) {
		    		$scope.invErrors.dob = true; valid = false;
		    	}
		    	if (!$scope.formData.email || !$scope.formData.email.trim()) {
		    		$scope.invErrors.email = true; valid = false;
		    	}
		    	if (!$scope.formData.phone_number || !$scope.formData.phone_number.trim()) {
		    		$scope.invErrors.phone_number = true; valid = false;
		    	}
		    	if (!vm.selected_phone || !vm.selected_phone.CountryCode) {
		    		$scope.invErrors.phone_number = true; valid = false;
		    	}
		    	if (!valid) {
		    		ToastService.warning('Missing Fields', 'Please fill in all required fields.');
		    		return;
		    	}

		    	// Password checks — tell the user exactly which rule failed
		    	// rather than a generic "missing fields" message.
		    	var pwMessage = PasswordPolicyService.Message($scope.formData.password);
		    	if (pwMessage) {
		    		$scope.invErrors.password = true;
		    		$scope.invErrors.password_msg = pwMessage;
		    		ToastService.warning('Password Not Strong Enough', pwMessage);
		    		return;
		    	}
		    	if (!$scope.formData.password2 || $scope.formData.password !== $scope.formData.password2) {
		    		$scope.invErrors.password2 = true;
		    		ToastService.warning('Passwords Don\'t Match', 'Your two passwords are different — please re-type the confirmation.');
		    		return;
		    	}

		    	$scope.invStep = 3;
		    	$state.go('invitations.next_of_kin');
		    };

		    $scope.validateNextOfKin = function() {
		    	$scope.invErrors = {};
		    	var valid = true;

		    	if (!$scope.formData.nok) $scope.formData.nok = {};

		    	if (!$scope.formData.nok.first_name || !$scope.formData.nok.first_name.trim()) {
		    		$scope.invErrors.nok_first_name = true; valid = false;
		    	}
		    	if (!$scope.formData.nok.last_name || !$scope.formData.nok.last_name.trim()) {
		    		$scope.invErrors.nok_last_name = true; valid = false;
		    	}
		    	if (!$scope.formData.nok.phone_number || !$scope.formData.nok.phone_number.trim()) {
		    		$scope.invErrors.nok_phone = true; valid = false;
		    	}
		    	if (!$scope.formData.nok.relationship || !$scope.formData.nok.relationship.trim()) {
		    		$scope.invErrors.nok_relationship = true; valid = false;
		    	}
		    	if (!$scope.formData.nok.address || !$scope.formData.nok.address.trim()) {
		    		$scope.invErrors.nok_address = true; valid = false;
		    	}

		    	if (!valid) {
		    		ToastService.warning('Missing Fields', 'Please fill in all required next of kin fields.');
		    		return;
		    	}

		    	$scope.invStep = 4;
		    	$state.go('invitations.your_club');
		    };

		    // One payload for every way to pay (card / direct debit / skip).
		    function signupPayload(method){
		    	var to_send = angular.copy($scope.formData);
		    	to_send.phone_number = e164Phone(vm.selected_phone && vm.selected_phone.CountryCode, to_send.phone_number);
		    	// date-only: a Date serialises as UTC and lands a day early in BST
		    	if (to_send.dob instanceof Date && !isNaN(to_send.dob.getTime())) {
		    		var d = to_send.dob;
		    		to_send.dob = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
		    	}
		    	to_send.request_id = $scope.all.membership_request_id;
		    	to_send.invitation = $stateParams.token;
		    	to_send.payment_now = $scope.payment_now;
		    	to_send.first_payment = $scope.first_payment;
		    	to_send.payment_method = method;
		    	return to_send;
		    }
		    function signupErrorText(data){
		    	var m = data && (data.message || data.error);
		    	return (typeof m === 'string' && m) ? m : "Something went wrong - nothing you entered has been lost. Please try again.";
		    }

		    $scope.validateAndSetupDD = function() {
		    	if (!validateTerms()) return;

		    	// Re-validate user + nok before submitting
		    	if (!check_user_is_valid()) {
		    		$scope.invStep = 2;
		    		$state.go('invitations.your_details');
		    		return;
		    	}
		    	if (!$scope.account_created && (!$scope.formData.nok || !$scope.formData.nok.first_name)) {
		    		$scope.invStep = 3;
		    		$state.go('invitations.next_of_kin');
		    		ToastService.warning('Missing Next of Kin', 'Please fill in your next of kin details.');
		    		return;
		    	}

		    	$scope.invLoading = true;
		    	$scope.setup_direct_debit();
		    };

		    $scope.validateTnc = function() {
		    	$scope.invErrors = {};

		    	if (!$scope.formData.tnc) {
		    		$scope.invErrors.tnc = true;
		    		ToastService.warning('Terms Required', 'You must accept the Terms & Conditions to continue.');
		    		return;
		    	}

		    	$scope.processForm();
		    };


		    // ══════════════════════════════════════════════
		    //  Payment method selection + Stripe + Skip
		    // ══════════════════════════════════════════════

		    $scope.selectPaymentMethod = function(method) {
		    	$scope.invPaymentMethod = method;
		    	$scope.invShowStripeForm = false;

		    	// Card: the form mounts once the account exists — a card belongs
		    	// to an account, and the SetupIntent is created as that account.
		    	// A brand-new invitee gets it after "Create account & add card".
		    	if (method === 'stripe' && $scope.account_created) {
		    		$scope.invShowStripeForm = true;
		    		setTimeout(function() { initStripeForm(); }, 150);
		    	}
		    };

		    function initStripeForm() {
		    	if (isPreview) {
		    		ToastService.warning('Preview', 'The live Stripe card form needs a real invitation — the rest of this step is fully previewable.');
		    		return;
		    	}
		    	// Only init once — if user toggles back we re-mount
		    	var uid = inviteeUid();
		    	if (!uid) { ToastService.error('Card Setup', 'Create your account first, then add the card.'); return; }
		    	var send = {
		    		club_id: $scope.formData.club_id,
		    		user_id: uid
		    	};

		    	PaymentService.CreateNewCustomer(send)
		    	.then(function(data) {
		    		if (!data || !data.secret) {
		    			ToastService.error('Card Setup Error', 'Unable to initialise card form. Please try again.');
		    			return;
		    		}

		    	  // Initialize Stripe.js with this club's per-club publishable key
	    	  PaymentService.GetClubStripeKey($scope.formData.club_id).then(function(stripeKey){
	    		var stripe = Stripe(stripeKey);

		    		var options = {
		    			clientSecret: data.secret,
		    			appearance: {
		    				theme: 'stripe',
		    				variables: {
		    					colorPrimary: '#2d5a8e',
		    					borderRadius: '10px',
		    					fontFamily: 'inherit'
		    				}
		    			}
		    		};

		    		var elements = stripe.elements(options);
		    		var paymentElement = elements.create('payment', { layout: 'tabs' });
		    		paymentElement.mount('#inv-payment-element');

		    		// Store for later use during submission
		    		invStripeElements = { stripe: stripe, elements: elements, clientSecret: data.secret };
		    	  }).catch(function(err){
		    	    // No usable publishable key for this club, or Stripe.js never
		    	    // loaded (CDN blocked) — leave the card form unmounted.
		    	    if(err && err.code === 'stripe_js_unavailable'){
		    	        ToastService.error('Card Form Not Loaded', "We couldn't load the secure card form. Your network or a browser extension may be blocking js.stripe.com — please allow it and try again.");
		    	    } else {
		    	        ToastService.error('Card Payments Unavailable', "Card payments aren't set up for this club yet. Please contact the club.");
		    	    }
		    	  }); // end GetClubStripeKey().then for invitation signup card
		    	});
		    }

		    $scope.validateAndSetupStripe = function() {
		    	// Re-entry guard (the button is pointer-events:none while loading,
		    	// but Stripe's confirmSetup step runs outside the global busy-guard).
		    	if ($scope.invLoading) return;
		    	// Validate T&C first
		    	if (!validateTerms()) return;

		    	// Re-validate user + nok
		    	if (!check_user_is_valid()) {
		    		$scope.invStep = 2;
		    		$state.go('invitations.your_details');
		    		return;
		    	}
		    	if (!$scope.account_created && (!$scope.formData.nok || !$scope.formData.nok.first_name)) {
		    		$scope.invStep = 3;
		    		$state.go('invitations.next_of_kin');
		    		ToastService.warning('Missing Next of Kin', 'Please fill in your next of kin details.');
		    		return;
		    	}

		    	if (isPreview) {
		    		$scope.invPaymentResult = 'stripe';
		    		$scope.invStep = 5;
		    		ToastService.success('Preview', 'Card setup simulated.');
		    		$state.go('invitations.direct_debit');
		    		return;
		    	}

		    	// Step 1 of 2: no account yet — create it (logged in), then show
		    	// the card form. If they stop here, the login gate brings them
		    	// back to this step next time.
		    	if (!$scope.account_created) {
		    		$scope.invLoading = true;
		    		UserService.InviteSignup(signupPayload('stripe')).then(function (data) {
		    			$scope.invLoading = false;
		    			if (data && data.success) {
		    				afterAccountCreated(data, function(){
		    					$scope.invShowStripeForm = true;
		    					setTimeout(function(){ initStripeForm(); }, 150);
		    					ToastService.success('Account Created', 'Now add your card to finish setting up your membership.');
		    				});
		    			} else if (handleExistingAccount(data)) {
		    				return;
		    			} else {
		    				ToastService.error('Signup Error', signupErrorText(data));
		    			}
		    		});
		    		return;
		    	}

		    	// Step 2 of 2: save the card. Stripe returns to
		    	// /direct_debit?stripe_success=1&setup_intent=… where it is confirmed.
		    	if (!invStripeElements) {
		    		ToastService.error('Card Not Ready', 'The card form is still loading. Please wait a moment.');
		    		return;
		    	}
		    	$scope.invLoading = true;
		    	invStripeElements.stripe.confirmSetup({
		    		elements: invStripeElements.elements,
		    		confirmParams: {
		    			return_url: window.location.origin + '/invitations/' + $stateParams.token + '/direct_debit?stripe_success=1'
		    		}
		    	}).then(function(result) {
		    		if (result && result.error) {
		    			$scope.$apply(function() {
		    				$scope.invLoading = false;
		    				ToastService.error('Card Error', result.error.message);
		    				var errEl = document.querySelector('#inv-stripe-error');
		    				if (errEl) errEl.textContent = result.error.message;
		    			});
		    		}
		    		// otherwise Stripe redirects to return_url
		    	});
		    };

		    // ── "You already have a ToAviate account" ──
		    // Not a dead end: store the token and swap the wizard for the
		    // log-in-to-accept state (form.html). After login, loginController
		    // calls invitations/accept_existing with the stored token.
		    // (FRONTEND_LOGBOOK_SIGNUP_GUIDE.md §5)
		    function acceptMergeAsLoggedIn(data) {
		    	$scope.invLoading = true;
		    	LogbookSignupService.AcceptExisting($stateParams.token).then(function(res){
		    		$scope.invLoading = false;
		    		if (res && res.success && res.mode === 'payment_pending') {
		    			$scope.signup_uid = Number(data.user_id);
		    			$scope.account_created = true;
		    			$scope.invResumed = true;
		    			try { localStorage.setItem(PAYMENT_GATE_KEY, JSON.stringify({ user_id: Number(data.user_id), token: $stateParams.token, club_title: (data.club && data.club.title) || '' })); } catch (e) {}
		    			ToastService.success('Invitation Accepted', 'Your existing account now belongs to ' + ((data.club && data.club.title) || 'the club') + ' - choose how to pay for the membership to finish.');
		    			$scope.invStep = 4;
		    			$state.go('invitations.your_club', { token: $stateParams.token }, { location: 'replace' });
		    			return;
		    		}
		    		if (res && res.success) {
		    			// nothing to pay — all done
		    			clearPaymentGate();
		    			try { localStorage.removeItem('toaviate_accept_invitation'); } catch (e) {}
		    			$scope.invMergeDone = true;
		    			return;
		    		}
		    		if (res && res.error === 'FORBIDDEN') {
		    			ToastService.error('Different Email', 'This invitation was sent to a different email address - please log in with the invited email to accept it.');
		    		} else {
		    			ToastService.error('Invitation', (res && res.message) || 'The invitation could not be accepted right now. Please try again.');
		    		}
		    		try { localStorage.setItem('toaviate_accept_invitation', $stateParams.token); } catch (e) {}
		    		$scope.invite_existing_account = true;
		    	});
		    }

		    function handleExistingAccount(data) {
		    	if (!data || !data.existing_account) { return false; }
		    	try { localStorage.setItem('toaviate_accept_invitation', $stateParams.token); } catch (e) {}
		    	$scope.invLoading = false;
		    	$scope.invite_existing_account = true;
		    	return true;
		    }

		    $scope.validateAndSkipPayment = function() {
		    	$scope.invErrors = {};
		    	var valid = true;
		    	if (!$scope.formData.membership_tnc) {
		    		$scope.invErrors.membership_tnc = true; valid = false;
		    	}
		    	if (!$scope.formData.tnc) {
		    		$scope.invErrors.tnc = true; valid = false;
		    	}
		    	// Paid memberships show a payment acknowledgment even when
		    	// skipping (for paid-up members it's the renewal wording) —
		    	// require it so all three payment paths behave the same.
		    	// Free memberships have no payment checkbox at all.
		    	if ($scope.membership && $scope.membership.price > 0 && !$scope.formData.payment) {
		    		$scope.invErrors.payment = true; valid = false;
		    	}
		    	if (!valid) {
		    		ToastService.warning('Please Accept All Terms', 'You must accept all terms and conditions to continue.');
		    		return;
		    	}

		    	// Re-validate user + nok
		    	if (!check_user_is_valid()) {
		    		$scope.invStep = 2;
		    		$state.go('invitations.your_details');
		    		return;
		    	}
		    	if (!$scope.account_created && (!$scope.formData.nok || !$scope.formData.nok.first_name)) {
		    		$scope.invStep = 3;
		    		$state.go('invitations.next_of_kin');
		    		ToastService.warning('Missing Next of Kin', 'Please fill in your next of kin details.');
		    		return;
		    	}

		    	// Show confirmation modal
		    	$scope.invShowSkipConfirm = true;
		    };

		    $scope.confirmSkipPayment = function() {
		    	$scope.invShowSkipConfirm = false;

		    	if (isPreview) {
		    		$scope.invPaymentResult = 'skipped';
		    		$scope.invStep = 5;
		    		ToastService.success('Preview', 'Skip-payment path simulated.');
		    		$state.go('invitations.direct_debit');
		    		return;
		    	}

		    	$scope.invLoading = true;

		    	// Create the account without payment (free tier / payment waived)
		    	UserService.InviteSignup(signupPayload('skip'))
		    	.then(function(data) {
		    		$scope.invLoading = false;
		    		if (data && data.success) {
		    			afterAccountCreated(data, function(){
		    				clearPaymentGate();
		    				$scope.invPaymentResult = 'skipped';
		    				$scope.invStep = 5;
		    				$state.go('invitations.direct_debit');
		    			});
		    		} else if (handleExistingAccount(data)) {
		    			return;
		    		} else {
		    			var msg = (data && (data.error || data.message)) || 'Unknown error';
		    			ToastService.error('Signup Error', 'An error occurred: ' + msg);
		    			if (String(msg).toLowerCase().indexOf('payment required') > -1) {
		    				// Backend refused the skip — clear it so the member
		    				// picks a real payment method instead.
		    				$scope.invPaymentMethod = null;
		    			}
		    		}
		    	});
		    };

		    // Helper: validate just the T&C checkboxes (shared by DD and Stripe flows)
		    function validateTerms() {
		    	$scope.invErrors = {};
		    	var valid = true;
		    	if (!$scope.formData.membership_tnc) {
		    		$scope.invErrors.membership_tnc = true; valid = false;
		    	}
		    	if (!$scope.formData.tnc) {
		    		$scope.invErrors.tnc = true; valid = false;
		    	}
		    	// Only require payment checkbox when price > 0
		    	if ($scope.membership && $scope.membership.price > 0 && !$scope.formData.payment) {
		    		$scope.invErrors.payment = true; valid = false;
		    	}
		    	if (!valid) {
		    		ToastService.warning('Please Accept All Terms', 'You must accept all terms and conditions to continue.');
		    	}
		    	return valid;
		    }


		    $scope.setup_direct_debit = function(){

		    	if(isPreview){
		    		$scope.invLoading = false;
		    		$scope.invPaymentResult = 'direct_debit';
		    		$scope.invStep = 5;
		    		ToastService.success('Preview', 'Direct debit setup simulated.');
		    		$state.go('invitations.direct_debit');
		    		return;
		    	}

		    	// //console.log("CHECK IS L ", $scope.checkValid("verify_account", 1));

		    	if($scope.checkValid("verify_account", 1)){

			    	UserService.InviteSignup(signupPayload('direct_debit'))
		                .then(function (data) {
		                    if(data && data.success){
		                    	afterAccountCreated(data, function(){
		                    		if (data.signup_status === 'completed') {
		                    			// retry after the mandate was already saved
		                    			$scope.invLoading = false;
		                    			$scope.invPaymentResult = 'direct_debit';
		                    			$scope.invStep = 5;
		                    			$state.go('invitations.direct_debit');
		                    			return;
		                    		}
		                    		if (data.mandate && data.mandate.link) {
		                    			// GoCardless hosted page; it returns to /direct_debit?redirect_flow_id=…
		                    			// (its own cookie — the app's `session` cookie is the LOGIN)
		                    			if (data.mandate.session) { $cookies.put("gcl_session", data.mandate.session); }
		                    			window.location = data.mandate.link;
		                    			return;
		                    		}
		                    		// Account made, mandate not started (the club's GoCardless is
		                    		// unavailable): offer the other ways to pay.
		                    		$scope.invLoading = false;
		                    		$scope.invPaymentMethod = null;
		                    		ToastService.error('Direct Debit Unavailable', (data.message || "The Direct Debit could not be started.") + " Your account has been created - please choose another way to pay.");
		                    	});
		                    } else if (handleExistingAccount(data)) {
		                    	return false;
		                    } else {
		                    	$scope.invLoading = false;
		                    	ToastService.error('Signup Error', signupErrorText(data));
		                    	return false;
		                    }
		            });

	            } else {
	            	$scope.invLoading = false;
	            	ToastService.warning('Incomplete Form', 'Please ensure that all fields are complete');
	            }





		    }

		    $scope.checkValid = function(uisref, gonext=0){
		    	if(!uisref || uisref == ""){
		    		//console.log("here");
		    		uisref = $(".btn-info").attr("one-ui-sref");
		    	}
		    	//console.log($('#signup-form')[0].checkValidity());
		    	if(! $('#signup-form')[0].checkValidity()){
		    		$(".ng-pristine").not(".ng-valid").removeClass("ng-pristine").addClass("ng-invalid");
		    		$("input:checkbox:not(:checked):required").addClass("ng-checkbox-unchecked");
		    		//console.log("STOP");
		    		return false;
		    	} else {

		    		//console.log("HERE");
		    		
		    		if(!check_user_is_valid()){
		    			//console.log("missing first bit...");
				    	$state.go("invitations.your_details");
		    			return false;
		    		}
		    		if(!$scope.formData.nok && !$scope.account_created){
		    			// (an existing account already has its next of kin on file)
		    			//console.log("missing second bit...");
				    	$state.go("invitations.next_of_kin");
		    			return false;
		    		}
		    		// if(!$scope.formData.club){
		    		// 	//console.log("missing second bit...");
				    // 	$state.go("invitations.your_club");
		    		// 	return false;
		    		// }
		    		if(!$scope.formData.tnc){
			    		$("input:checkbox:not(:checked)").addClass("ng-checkbox-unchecked");
		    		} else {
		    			$("input:checkbox:not(:checked)").removeClass("ng-checkbox-unchecked");
		    		}
		    		if($scope.formData.password == $scope.formData.password2){
			    		var next = uisref;
			    		if(gonext == 0){
			    			if(next == "verify_account"){
				    			//console.log("verifying account");
				    			$scope.processForm();
				    		} else {
					    		$state.go(next);
				    		}
			    		} else {
			    			return true;
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

		    // "Verify My Account": text the code to the invitee. The request
		    // carries the invitation token (or the login) so only THIS signup can
		    // trigger an SMS to this account.
		    $scope.sendVerification = function(){
		    	$scope.invStep = 6;
		    	if(isPreview){
		    		ToastService.success('Preview', 'Verification SMS simulated.');
		    		$scope.codeSent = true;
		    		$state.go('invitations.verified');
		    		return;
		    	}
		    	var user_id = inviteeUid();
		    	if (!user_id) {
		    		ToastService.error('Verification', "We couldn't find your new account - please reload the page from your invitation link.");
		    		return;
		    	}
		    	MemberService.VerifyInvitedUser(user_id, $stateParams.token).then(function (data) {
		    		if(data && data.success){
		    			$scope.codeSent = true;
		    			$scope.checkedcode = 0;
		    			$state.go("invitations.verified");
		    		} else {
		    			ToastService.error('Code Not Sent', (data && data.message) || "We couldn't text you the code just now. Please try again in a moment.");
		    			$state.go("invitations.verified");
		    		}
		    	});
		    };

		    // "Didn't get it?" — a fresh code (the backend regenerates it, which
		    // also clears a too-many-attempts lock). Rate-limited server-side.
		    $scope.resendBusy = false;
		    $scope.resendCode = function(){
		    	if ($scope.resendBusy) { return; }
		    	if (isPreview) { ToastService.success('Preview', 'Code re-sent (simulated).'); return; }
		    	var user_id = inviteeUid();
		    	if (!user_id) { return; }
		    	$scope.resendBusy = true;
		    	MemberService.ResendPhoneCode(user_id).then(function (data) {
		    		$scope.resendBusy = false;
		    		if (data && data.success) {
		    			$scope.codeSent = true;
		    			$scope.checkedcode = 0;
		    			$scope.codeError = '';
		    			$scope.formcode = [];
		    			for (var i = 0; i < 6; i++) { var el = document.getElementById('index' + i); if (el) { el.value = ''; } }
		    			ToastService.success('Code Sent', (data.message) || 'A new code is on its way to your phone.');
		    		} else {
		    			ToastService.error('Not Sent', (data && data.message) || "We couldn't send a new code just now.");
		    		}
		    	});
		    };


		    // ── Stripe-style smooth code input ──

		    var CODE_LENGTH = 6;
		    $scope.formcode = [];
		    $scope.checkedcode = 0;
		    $scope.codeVerifying = false;
		    $scope.codeError = '';

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

		        // Mobile keyboards report 229 / "Unidentified" / "Process" on keydown
		        // and deliver the digit through the input event instead.
		        if (key === 229 || key === 'Unidentified' || key === 'Process') { return; }
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
		                    // ng-input is not an AngularJS directive: bind the input event here
		                    if (!el.getAttribute('data-code-input-bound')) {
		                        el.setAttribute('data-code-input-bound', '1');
		                        el.addEventListener('input', function(e) {
		                            $scope.$apply(function() { $scope.onCodeInput({ target: el }, idx); });
		                        });
		                    }
		                }
		            })(i);
		        }
		    }

		    setTimeout(attachPasteHandlers, 200);
		    $scope.$on('$viewContentLoaded', function() {
		        setTimeout(attachPasteHandlers, 200);
		    });

		    // ── WebOTP: auto-prefill the code from the SMS (Android Chrome) ──
		    // Needs the SMS to end with the origin-bound line, e.g.
		    // "@app.toaviate.com #123456" — see BACKEND_SMS_OTP_AUTOFILL_GUIDE.md.
		    // Silent no-op on browsers without OTPCredential support.
		    if ('OTPCredential' in window && typeof AbortController !== 'undefined') {
		        var otpAbort = new AbortController();
		        $scope.$on('$destroy', function () { otpAbort.abort(); });
		        navigator.credentials.get({ otp: { transport: ['sms'] }, signal: otpAbort.signal })
		            .then(function (otp) {
		                if (otp && otp.code) {
		                    $scope.$apply(function () { fillCodeFromString(otp.code); });
		                }
		            })
		            .catch(function () { /* aborted or dismissed — manual entry still works */ });
		    }

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
		            $scope.codeError = 'Too many attempts - tap "Send a new code" below to get a fresh one.';
		            return;
		        }

		        $scope.codeVerifying = true;
		        $scope.codeError = '';

		        if (isPreview) {
		            $scope.codeVerifying = false;
		            $scope.verified_mobile = true;
		            ToastService.success('Preview', 'Phone verification simulated — any code passes.');
		            return;
		        }

		        MemberService.VerifyPhoneInvite(combine, inviteeUid())
		            .then(function (data) {
		                $scope.codeVerifying = false;
		                if (data && data.success) {
		                    $scope.verified_mobile = true;
		                } else {
		                    $scope.codeError = 'Your verification code is incorrect. Please try again.';
		                    // Shake animation
		                    var group = document.getElementById('codeInputGroup');
		                    if (group) {
		                        group.classList.add('inv-code-inputs--shake');
		                        setTimeout(function() { group.classList.remove('inv-code-inputs--shake'); }, 500);
		                    }
		                }
		            }, function() {
		                $scope.codeVerifying = false;
		                $scope.codeError = 'Something went wrong. Please try again.';
		            });
		    };

		    // Keep legacy verify_mobile for backwards compatibility
		    $scope.verify_mobile = function(value) {
		        // Redirected to submitCode — kept for any external callers
		        $scope.submitCode();
		    };

    		function titlepath(path,name){

        //Open the document in a centred popup window so the signup form
        //stays visible behind it (a bare window.open() covered the screen).
            var w = Math.min(900, window.screen.availWidth - 40);
            var h = Math.min(800, window.screen.availHeight - 80);
            var left = Math.max(0, Math.round((window.screen.availWidth - w) / 2));
            var top = Math.max(0, Math.round((window.screen.availHeight - h) / 2));
            var prntWin = window.open('', '_blank', 'popup=yes,width=' + w + ',height=' + h + ',left=' + left + ',top=' + top + ',resizable=yes,scrollbars=yes');
            if (!prntWin) {
                // popup blocked — fall back to a normal new tab
                window.open(path, '_blank');
                return;
            }
            prntWin.document.write("<html><head><title>"+name+"</title></head><body style=\"margin:0\">"
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
                console.info("saveBlob method failed with the following exception:");
                console.info(ex);
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
                            console.info("Download link method with simulated click failed with the following exception:");
                            console.info(ex);
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


		    // function to process the form
		    $scope.processForm = function() {

		    	// This also fires on an Enter-key implicit form submission.
		    	// On the earlier steps, Enter advances the current step; on
		    	// the payment step it must do nothing (payment has explicit
		    	// buttons — an implicit submit here would create the account
		    	// with no payment method).
		    	if ($scope.invLoading) { return; }
		    	if ($state.current.name === 'invitations.your_details') {
		    		$scope.validateDetails();
		    		return;
		    	}
		    	if ($state.current.name === 'invitations.next_of_kin') {
		    		$scope.validateNextOfKin();
		    		return;
		    	}
		    	if ($state.current.name !== 'invitations.tnc') {
		    		return;
		    	}
		    	if (!check_user_is_valid()) {
		    		$state.go('invitations.your_details');
		    		return;
		    	}
		    	if (!$scope.formData.nok || !$scope.formData.nok.first_name) {
		    		ToastService.warning('Missing Next of Kin', 'Please fill in your next of kin details.');
		    		$state.go('invitations.next_of_kin');
		    		return;
		    	}
		    	if (!$scope.formData.tnc) {
		    		ToastService.warning('Terms Required', 'You must accept the Terms & Conditions to continue.');
		    		return;
		    	}

		    	if (isPreview) {
		    		ToastService.success('Preview', 'Signup simulated.');
		    		$state.go('invitations.verified');
		    		return;
		    	}

		    	$scope.invLoading = true;
		    	//send a copy with the phone normalised to E.164 — never mutate
		    	//the live form data (it feeds the auto-saved draft)
		    	var to_send = angular.copy($scope.formData);
		    	to_send.phone_number = e164Phone(vm.selected_phone && vm.selected_phone.CountryCode, to_send.phone_number);
		        UserService.InviteSignup(to_send)
	                .then(function (data) {
		    			//console.log("INVITATION BEING SENT NOW...", data);

	                    $scope.invLoading = false;
	                    if(data && data.success !== false){
	                    	//console.log("success");
	                    	SignupDraftService.Clear(DRAFT_KEY);
	                    	ToastService.success('Success', 'All good to go!');
	                    	$state.go("invitations.verified");
	                    } else if (handleExistingAccount(data)) {
	                    	return;
	                    } else {
	                    	ToastService.error('Signup Failed', 'An error occurred: ' + ((data && (data.error || data.message)) || 'please try again.') + ' Nothing you entered has been lost.');
	                    }
	                });








		    };

    }