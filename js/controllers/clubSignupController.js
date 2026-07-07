app.controller('ClubSignupController', ClubSignupController);

    ClubSignupController.$inject = ['ClubService', 'MemberService', 'UserService', 'GoCardService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$cookies', '$http', 'ToastService', 'SignupDraftService', 'PasswordPolicyService' ];
    function ClubSignupController(ClubService, MemberService, UserService, GoCardService, $rootScope, $location, $scope, $state, $stateParams, $cookies, $http, ToastService, SignupDraftService, PasswordPolicyService) {
        

    		var vm = this;


    		$scope.companies = [];

    		$scope.selected_company;

    		$scope.selected_phone;

    		

    		$scope.verified_mobile = false;
    		$scope.text_verification = "";

    		vm.check_id = 12;

    		$scope.link = "";

    		//country code for text messages

    		$scope.prefix = "";


    		$scope.countries = [
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


    		


    		var loc = $location.path().split("/");

    		if(loc[loc.length -3] == "verified"){
    		
	    		var last = loc[loc.length -1];
	    		var pre = loc[loc.length -2];

	            //console.log("THIS IS A VERIFY TOKEN VERIFICATION", pre);

	    		if(last && pre){

		            //console.log("THIS IS A VERIFY TOKEN VERIFICATION", last);

		             UserService.Verify(last, pre)
		                .then(function (response) {
		                    if (response.success) {
		                    	//alert("verified");

		                    	//lets create a temp create cookie here...

		                        // vm.title = "Thank You!";
		                        // vm.verify_status = "Your email address has been verified.";
		                    } else {
		                    	ToastService.error('Verification Failed', 'Sorry - your verification link seems to be incorrect.')
		                        // vm.title = "Sorry!";
		                        // vm.verify_status = "Sorry - something went wrong here! Please try clicking the link your email again. Should this still be a problem, please contact support.";
		                    }
		                });

		        }            
    		}


    		if(loc[loc.length -1].split("?")[0] == "payment_setup_confirmation"){

    			// //console.log("PARAMS1231", $location.search());
	    		// //console.log("PARAMSCODE123", $location.search().code);

	    		var mid = $cookies.get('mid');
	    		var bid = $cookies.get('bid');

	    		// //console.log("PARAMS123123", mid);

	    		 GoCardService.SetupGoCard({mid: mid, bid: bid, code: $location.search().code})
		                .then(function (response) {
		                	//console.log("response", response);
		                    if (response.success) {
		                    	//alert("verified");
		                    	
		                    	//SetupGoCard

		                        // vm.title = "Thank You!";
		                        // vm.verify_status = "Your email address has been verified.";
		                    } else {
		                    	ToastService.error('Setup Failed', 'Sorry - we were unable to setup your connection to our payment provider GoCardless.')
		                        // vm.title = "Sorry!";
		                        // vm.verify_status = "Sorry - something went wrong here! Please try clicking the link your email again. Should this still be a problem, please contact support.";
		                    }
		                });




    		}

    		$scope.go_to_login = function(){
				$state.go("login");
    		}

    		

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
    		        $scope.codeError = '';
    		        ToastService.error('Too Many Attempts', 'Sorry - you have tried too many times. Please request a new code.');
    		        return;
    		    }

    		    $scope.codeVerifying = true;
    		    $scope.codeError = '';

    		    MemberService.VerifyPhone(combine, last)
    		        .then(function (data) {
    		            $scope.codeVerifying = false;
    		            if (data && data.success) {
    		                $scope.verified_mobile = true;
    		                $scope.link = data.link.url;
    		                $cookies.put('mid', last);
    		                $cookies.put('bid', data.bid);
    		            } else {
    		                $scope.codeError = 'Your verification code is incorrect. Please try again.';
    		                var group = document.getElementById('codeInputGroup');
    		                if (group) {
    		                    group.classList.add('inv-code-inputs--shake');
    		                    setTimeout(function() { group.classList.remove('inv-code-inputs--shake'); }, 500);
    		                }
    		                $scope.verified_mobile = false;
    		            }
    		        }, function() {
    		            $scope.codeVerifying = false;
    		            $scope.codeError = 'Something went wrong. Please try again.';
    		        });
    		};

    		// Keep legacy verify_mobile for backwards compatibility
    		$scope.verify_mobile = function() {
    		    $scope.submitCode();
    		};



    		$scope.get_companies = function(name){
		         
		            if(name.length > 2){

		             MemberService.GetCompany(name)
		                .then(function (data) {
		                    //console.log(data);
		                    if(data.success){
		                        //use GB airfields first...
		                        $scope.companies = data.items;

		                    } else {


		                            //console.log("WOOOPSIES...");
		                            //this should be very very rare...
		                        
		                        
		                   
		                    }

		                });


		            }
		        }

		        $scope.prefix_length = 0;
		        $scope.prefix = "";

		        $scope.set_prefix = function(){

		        	//$scope.prefix = 

		        	// var current_phone = $scope.formData.user.phone;
		        	// if($scope.prefix_length > 0){
		        	// 	current_phone = current_phone.substring($scope.prefix_length);
		        	// }
		        	// $scope.prefix_length = vm.selected_phone.CountryCode.length;
		        	// $scope.prefix = vm.selected_phone.CountryCode + "" + current_phone;

		        }

		        $scope.set_company = function(){
		        	

		        	 MemberService.GetCompanyDetail(vm.selected_company.company_number)
		                .then(function (data) {
		                    //console.log(data);
		                    if(data.success){
		                        //use GB airfields first...
		                        //console.log("detail", data);
		                        $scope.company = data;

		                        sort_company_data(data);




		                    } else {


		                            //console.log("WOOOPSIES...");
		                            //this should be very very rare...
		                        
		                        
		                   
		                    }

		                });

		        }

         	// we will store all of our form data in this object
		    $scope.formData = {
		    	club: {
		    		is_company: true
		    	},
		    	user: {
		    		phone: ""
		    	}
		    };

		    // ── Modern form validation infrastructure ──
		    $scope.formErrors = {};
		    $scope.formStep = 1;

		    $scope.setFormStep = function(n) {
		        $scope.formStep = n;
		    };

		    // ── Refresh / back-forward robustness ──────────────────────────
		    // Form data lives on the parent state's scope, so a page refresh
		    // used to wipe everything. We auto-save a sanitised draft (never
		    // passwords or T&C ticks) and restore it here, keep the stepper in
		    // sync with the browser's back/forward buttons, and bounce deep
		    // links to a step whose prerequisite data is missing.

		    var DRAFT_KEY = 'club_signup';

		    // state name → stepper position (club_signup 1-4, club_signup2 5-8)
		    var STEP_BY_STATE = {
		        'club_signup':            1,
		        'club_signup.my_profile': 1,
		        'club_signup.my_club':    2,
		        'club_signup.terms':      3,
		        'club_signup.verify':     4,
		        'club_signup2':           5,
		        'club_signup2.verify':    5,
		        'club_signup2.payment':   6,
		        'club_signup2.payment2':  6,
		        'club_signup2.payment_setup_confirmation':  7,
		        'club_signup2.payment_setup_confirmation2': 7,
		        'club_signup2.complete':  8
		    };

		    function syncStepFromState(stateName) {
		        if (STEP_BY_STATE[stateName]) {
		            $scope.formStep = STEP_BY_STATE[stateName];
		        }
		    }

		    // Steps 2-3 need the profile from step 1. (Step 4+ are post-submit
		    // informational screens — never bounce those.)
		    function guardStep(stateName) {
		        if (stateName !== 'club_signup.my_club' && stateName !== 'club_signup.terms') { return; }
		        var user = $scope.formData.user || {};
		        if (!user.first_name || !user.email) {
		            ToastService.warning('Start With Your Details', 'Please complete your personal details first — anything you had already entered has been restored.');
		            $state.go('club_signup.my_profile', {}, { location: 'replace' });
		            return;
		        }
		        if (!user.password) {
		            ToastService.warning('Please Re-enter Your Password', 'For security we never store your password — please re-enter it to continue.');
		            $state.go('club_signup.my_profile', {}, { location: 'replace' });
		        }
		    }

		    // Restore any saved draft (never contains passwords / T&C ticks).
		    var draft = SignupDraftService.Load(DRAFT_KEY);
		    if (draft && draft.formData) {
		        if (draft.formData.user) { angular.extend($scope.formData.user, draft.formData.user); }
		        if (draft.formData.club) { angular.extend($scope.formData.club, draft.formData.club); }
		        if (draft.selected_phone) { vm.selected_phone = draft.selected_phone; }
		        if ($scope.formData.user.first_name || $scope.formData.club.title) {
		            ToastService.success('Progress Restored', 'Welcome back — we saved what you had entered so far.');
		        }
		    }

		    // Auto-save as the user types (debounced, sanitised).
		    SignupDraftService.Watch($scope, DRAFT_KEY, function () {
		        return { formData: $scope.formData, selected_phone: vm.selected_phone };
		    });

		    // Landing on the bare parent URL shows an empty card — send the
		    // user to the first step instead.
		    if ($state.current.name === 'club_signup') {
		        $state.go('club_signup.my_profile', {}, { location: 'replace' });
		    } else {
		        syncStepFromState($state.current.name);
		        guardStep($state.current.name);
		    }

		    // Keep the stepper + guards in sync when the user navigates with
		    // the browser's back/forward buttons (child state changes do not
		    // re-instantiate this controller).
		    $scope.$on('$stateChangeSuccess', function (event, toState) {
		        if (toState.name === 'club_signup') {
		            $state.go('club_signup.my_profile', {}, { location: 'replace' });
		            return;
		        }
		        syncStepFromState(toState.name);
		        guardStep(toState.name);
		    });

		    $scope.clearFormError = function(field) {
		        if ($scope.formErrors[field]) {
		            delete $scope.formErrors[field];
		        }
		    };

		    // Live password-requirements checklist under the password field.
		    $scope.pwCheck = PasswordPolicyService.Rules;

		    // Scroll to the first field with an error
		    function scrollToFirstError() {
		        setTimeout(function() {
		            var el = document.querySelector('.inv-field--error');
		            if (el) {
		                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		            }
		        }, 100);
		    }

		    // Step 1: Validate profile details
		    $scope.validateProfile = function() {
		        $scope.formErrors = {};
		        var valid = true;

		        if (!$scope.formData.user.first_name || !$scope.formData.user.first_name.trim()) {
		            $scope.formErrors.first_name = true; valid = false;
		        }
		        if (!$scope.formData.user.last_name || !$scope.formData.user.last_name.trim()) {
		            $scope.formErrors.last_name = true; valid = false;
		        }
		        if (!$scope.formData.user.dob_day || !$scope.formData.user.dob_month || !$scope.formData.user.dob_year) {
		            $scope.formErrors.dob = true; valid = false;
		        }
		        if (!$scope.formData.user.email || !$scope.formData.user.email.trim()) {
		            $scope.formErrors.email = true; valid = false;
		        }
		        if (!$scope.formData.user.phone || !$scope.formData.user.phone.trim()) {
		            $scope.formErrors.phone = true; valid = false;
		        }
		        if (!valid) {
		            ToastService.warning('Missing Fields', 'Please fill in all required fields.');
		            scrollToFirstError();
		            return;
		        }

		        // Password checks — tell the user exactly which rule failed
		        // rather than a generic "missing fields" message.
		        var pwMessage = PasswordPolicyService.Message($scope.formData.user.password);
		        if (pwMessage) {
		            $scope.formErrors.password = true;
		            $scope.formErrors.password_msg = pwMessage;
		            ToastService.warning('Password Not Strong Enough', pwMessage);
		            scrollToFirstError();
		            return;
		        }

		        if ($scope.formData.user.password !== $scope.formData.user.password2) {
		            $scope.formErrors.password2 = true;
		            ToastService.warning('Passwords Don\'t Match', 'Your two passwords are different — please re-type the confirmation.');
		            scrollToFirstError();
		            return;
		        }

		        if (!vm.selected_phone || !vm.selected_phone.CountryCode) {
		            $scope.formErrors.phone = true;
		            ToastService.warning('Country Code Required', 'Please select the country prefix for your mobile number.');
		            scrollToFirstError();
		            return;
		        }

		        $scope.formStep = 2;
		        $state.go('club_signup.my_club');
		    };

		    // Step 2: Validate club/organisation details
		    $scope.validateClub = function() {
		        $scope.formErrors = {};
		        var valid = true;

		        if (!$scope.formData.club.title || !$scope.formData.club.title.trim()) {
		            $scope.formErrors.club_title = true; valid = false;
		        }
		        if (!$scope.formData.club.email || !$scope.formData.club.email.trim()) {
		            $scope.formErrors.club_email = true; valid = false;
		        }

		        if (!valid) {
		            ToastService.warning('Missing Fields', 'Please fill in the required organisation fields.');
		            scrollToFirstError();
		            return;
		        }

		        $scope.formStep = 3;
		        $state.go('club_signup.terms');
		    };

		    // Step 3: Validate terms & conditions
		    $scope.validateTerms = function() {
		        if (!$scope.formData.tnc) {
		            ToastService.warning('Terms Required', 'Please accept the Terms & Conditions to continue.');
		            return;
		        }

		        $scope.formStep = 4;
		        $scope.processForm();
		    };

		    // ── club_signup_continued (club_signup2) validation ──

		    // Validate club details for continued signup (step 2)
		    $scope.validateClub2 = function() {
		        $scope.formErrors = {};
		        var valid = true;

		        if (!$scope.formData.club || !$scope.formData.club.title || !$scope.formData.club.title.trim()) {
		            $scope.formErrors.title = true; valid = false;
		        }
		        if (!$scope.formData.club || !$scope.formData.club.email || !$scope.formData.club.email.trim()) {
		            $scope.formErrors.club_email = true; valid = false;
		        }
		        if ($scope.formData.club && $scope.formData.club.is_company) {
		            if (!$scope.formData.club.company_name || !$scope.formData.club.company_name.trim()) {
		                $scope.formErrors.company_name = true; valid = false;
		            }
		        }

		        if (!valid) {
		            ToastService.warning('Missing Fields', 'Please fill in all required organisation fields.');
		            scrollToFirstError();
		            return;
		        }

		        $scope.formStep = 3;
		        $state.go('club_signup2.terms');
		    };

		    // Validate terms for continued signup (step 3)
		    $scope.validateTerms2 = function() {
		        if (!$scope.formData.tnc) {
		            ToastService.warning('Terms Required', 'Please accept the Terms & Conditions to continue.');
		            return;
		        }

		        $scope.formStep = 4;
		        $state.go('club_signup2.verify');
		    };



		    function sort_company_data(data){

		    	vm.officers = data.officer;
		    	vm.company_details = data.company;

		    	//match the firstname and last name entered with a director of the company
		    	var user_is_named_on_company_selected = false;

		    	var fname = $scope.formData.user.first_name.toLowerCase();
		    	var lname = $scope.formData.user.last_name.toLowerCase();
		    	var matched = 0;




		    	for(var i=0; i<vm.officers.length;i++){

		    		if(vm.officers[i].name.toLowerCase().indexOf(fname) > -1 && vm.officers[i].name.toLowerCase().indexOf(lname) > -1){

		    			user_is_named_on_company_selected = true;
		    			matched = i;

		    		}

		    	}


		    	if(user_is_named_on_company_selected){

		    		ToastService.success('Match Found', 'We have matched you!');

		    		//now that we have some basic setup then we can get into the nitty gritty of adding
		    		$scope.formData.club = {};

		    		$scope.formData.club.company_name = data.company.company_name;
		    		$scope.formData.club.trading_as = data.company.company_name;
		    		$scope.formData.club.title = data.company.company_name.replace("LTD", "").replace("LIMITED", "").replace("LLC", "");
		    		$scope.formData.club.company_number = data.company.company_number;
		    		$scope.formData.club.date_of_creation = data.company.date_of_creation;
		    		$scope.formData.club.address_line_1 = data.company.registered_office_address.address_line_1;
		    		$scope.formData.club.address_line_2 = data.company.registered_office_address.address_line_2;
		    		$scope.formData.club.city = data.company.registered_office_address.locality;
		    		$scope.formData.club.post_code = data.company.registered_office_address.postal_code;

		    		$scope.formData.user.dob_year = data.officer[matched].date_of_birth.year;
		    		$scope.formData.user.dob_month = data.officer[matched].date_of_birth.month;
		    		$scope.formData.user.role = data.officer[matched].officer_role;
		    		$scope.formData.club.is_company = true;
		    		



		    	} else {

		    		ToastService.error('No Match', 'Unfortunately we cannot match your personal details with any of the company directors. Did you select the correct company from the drop-down list?');

		    	}






		    }

		    $scope.setup_direct_debit = function(){
		    	//console.log($scope.link);
		    	window.open($scope.link);
		    	//window.location = $scope.link;

		    }
		    
		    $scope.checkValid = function(){
		    	console.log("CLICK");
		    	//console.log($('#signup-form')[0].checkValidity());


          //console.log("HERE WE GO?");

            //let's check the passwords match first...
            if($scope.formData.user.password !== $scope.formData.user.password2){
              $("input[type='password']").removeClass("ng-pristine").addClass("ng-invalid");
              ToastService.warning('Password Mismatch', 'Your passwords do not match');
              return false;
            }

            //check the password against the shared policy
            var pwMessage = PasswordPolicyService.Message($scope.formData.user.password);
            if(pwMessage) {
              $("input[type='password']").removeClass("ng-pristine").addClass("ng-invalid");
              ToastService.warning('Password Not Strong Enough', pwMessage);
              return false;
            }



		    	if(! $('#signup-form')[0].checkValidity()){
		    		$(".ng-pristine").not(".ng-valid").removeClass("ng-pristine").addClass("ng-invalid");
		    		$("input:checkbox:not(:checked)").addClass("ng-checkbox-unchecked");
		    		//console.log("STOP");
		    		return false;
		    	} else {
		    		//console.log("HERE");
		    		$("input:checkbox:not(:checked)").removeClass("ng-checkbox-unchecked");
		    		if(!$scope.formData.user){
		    			//console.log("missing first bit...");
				    	$state.go("club_signup.my_profile");
		    			return false;
		    		}

		    		if(!vm.selected_phone.CountryCode){
			    		ToastService.warning('Country Code Required', 'Please select the country prefix of the mobile phone entered from the drop-down menu, this will ensure that the text messages we send will be sent to the correct telephone number.');
			    		return false;
			    	}
			    	var mobile = $scope.formData.user.phone;

			    	if($scope.formData.user.phone.slice(0,1) == 0){
			    		ToastService.warning('Phone Number', 'Your telephone number seems to start with a 0, as we will be using your international phone number, the first zero will be stripped automatically.');
			    		$scope.formData.user.phone.phone = $scope.formData.user.phone.phone.substring(1);
			    	}

		    		if(!$scope.formData.club || !$scope.formData.club.title){
		    			//console.log("missing second bit...");
				    	$state.go("club_signup.my_club");
		    			return false;
		    		}
		    		if(!$scope.formData.tnc){
		    			//console.log("missing third bit...");
				    	$state.go("club_signup.terms");
		    			return false;
		    		}

            
            
		    		if($scope.formData.user.password == $scope.formData.user.password2){
			    		var next = $(".btn-info").attr("one-ui-sref") || $(".inv-btn--primary").attr("one-ui-sref") || $(".inv-btn--success").attr("one-ui-sref");
			    			//console.log("NEXT", next);
			    		if(next == "club_signup.verify"){
			    			//console.log("verifying account");
			    			$scope.processForm();
			    		} else {
				    		$state.go(next);
			    		}
		    		} else {
			    		$("input[type='password']").removeClass("ng-pristine").addClass("ng-invalid");
		    			return false;
		    		}
		    	}
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

		    // function to process the form
		    $scope.submitting = false;
		    $scope.processForm = function() {
		         if ($scope.submitting) { return; }

		         // This also fires on an Enter-key implicit form submission.
		         // On steps 1-2, Enter should advance the current step, not
		         // submit the whole wizard.
		         if ($state.current.name === 'club_signup.my_profile') {
		             $scope.validateProfile();
		             return;
		         }
		         if ($state.current.name === 'club_signup.my_club') {
		             $scope.validateClub();
		             return;
		         }
		         // From the terms step (or anywhere else) never send an
		         // incomplete form.
		         if (!$scope.formData.user || !$scope.formData.user.email || !$scope.formData.user.password || !vm.selected_phone || !vm.selected_phone.CountryCode) {
		             $scope.validateProfile();
		             return;
		         }
		         if (!$scope.formData.club || !$scope.formData.club.title) {
		             $scope.validateClub();
		             return;
		         }
		         if (!$scope.formData.tnc) {
		             ToastService.warning('Terms Required', 'Please accept the Terms & Conditions to continue.');
		             return;
		         }

		         if ($scope.formData) {
	                //contact the service to create a new club! :)

	                //sort out the phone number on a copy — never mutate the
	                //live form data, or a failed submit + retry would prepend
	                //the country code a second time.
	                var payload = angular.copy($scope.formData);
	                payload.user.phone = e164Phone(vm.selected_phone.CountryCode, payload.user.phone);

	                $scope.submitting = true;

 					//console.log("GO!");
 					ClubService.Create(payload)
		                .then(function(data){
		                    //console.log(data);
		                    $scope.submitting = false;
		                    if(data.success){
			                    SignupDraftService.Clear(DRAFT_KEY);
			                    $state.go("club_signup.verify");
			                    $scope.formData = {};
		                    } else {
		                    	$("#error_message").html(data.message);
		                    	ToastService.error('Signup Failed', data.message || 'Something went wrong — please check your details and try again. Nothing you entered has been lost.');
		                    }
		                });

	            } else {
	            	ToastService.error('Error', 'Something went wrong.');
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