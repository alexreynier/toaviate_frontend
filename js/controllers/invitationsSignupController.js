 app.controller('InvitationsSignupController', InvitationsSignupController);

    InvitationsSignupController.$inject = ['UserService', 'MemberService', 'GoCardService', '$http', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$cookies', '$log', 'ToastService'];
    function InvitationsSignupController(UserService, MemberService, GoCardService, $http, $rootScope, $location, $scope, $state, $stateParams, $cookies, $log, ToastService) {
        	
        	var vm = this;

        	$scope.formData = {};


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

				
				




    		
    		//automatically sort stuff out! :)
    		if($state.params.verify){
    			ToastService.warning('Verification', 'VERIFY?');
    			////console.log("SEND VERIFICATION");
    			UserService.Verify($state.params.user_id, $state.params.verify)
                .then(function (data) {
	    			// //console.log("SENT VERIFICATION");
        //         	//console.log(data);
                    if(data.success){
                    	$state.go("verified");
                    } else {
                    	ToastService.error('Error', data.message);
                    	$state.go("login");
                    }
                });
    		}

    		var loc = $location.path().split("/");
    		if(loc[loc.length -1] == "verified"){

    			//alert("testing the sent");

    			sendVerification();

    		}


    		if($stateParams.token){

    			
    			UserService.GetInvite($stateParams.token)
                .then(function (data) {
	    			////console.log("GETTING TOKEN", data);


                    if(data){

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

		    			if(data.user_id > 0){
		    				// //console.log("UID set", data.user_id);
		    				$cookies.put("uid", data.user_id);
		    			}

		    			//$cookies.set("rid", data.membership.request.membership_request_id);
		    			//other data::
		    			$scope.payment_now = data.payment_now;
		    			$scope.first_payment = data.first_payment;
		    			$scope.club = data.club;
		    			$scope.membership = data.membership;

		    			$scope.all = data;

                    	////console.log("success");
                    } else {
                    	ToastService.error('Invitation Not Found', 'Sorry we were unable to find this invitation. Please try clicking the link again.')
                    	$state.go("login");
                    }
                });

    		} else {
    			$state.go("login");
    		}
	    
		    if($cookies.get("session") !== "" && $location.search().redirect_flow_id){
		    	//console.log("let's sort this shizzle out eh?");

		    	var object = {
                    mandate: $location.search().redirect_flow_id,
                    session: $cookies.get("session"),
                    member_accepted: true
                };

                GoCardService.SetupMandate(object).then(function (data) {
                    if(data.success){
                        //vm.requests = data.requests;
						// $cookies.set("uid");
                        //vm.club = data.club;
                        // //console.log("memberships", vm.memberships);
                        //vm.success = true;

                    } else {
                        // //console.log("WOOOPSIES...");
                        //vm.success = false;
                        //this should be very very rare...
                    }

                });

		    }


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



		    function check_user_is_valid(){

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

		    	if($scope.formData.password.length < 7){
		    		//not long enough
		    		ToastService.warning('Password Too Short', 'Password must be more than 7 characters long');
		    		return false;
		    	}

		    	if($scope.formData.password !== $scope.formData.password2){
		    		//passwords do not match
		    		ToastService.warning('Password Mismatch', 'Your passwords do not match.');
		    		return false;
		    	}

		    	return true;
		    }
		    

		    $scope.setup_direct_debit = function(){


		    	// //console.log("CHECK IS L ", $scope.checkValid("verify_account", 1));

		    	if($scope.checkValid("verify_account", 1)){

			    	var to_send = $scope.formData;
			    	to_send.request_id = $scope.all.membership_request_id;
			    	to_send.invitation = $stateParams.token;

			    	to_send.payment_now = $scope.payment_now;
			    	to_send.first_payment = $scope.first_payment;
			    	// //console.log("OBJ = ", to_send);

			    	//return false;
			    	//send the create user to the invitation
			    	//create_user
			    	//expect the gocardless link back
			    	UserService.InviteSignup(to_send)
		                .then(function (data) {
			    			// //console.log("INVITATION BEING SENT NOW...", data);
		                    if(data.success){
		                    	// //console.log("YAY we created stuff");

		                    	//store the session::::::
		                    	$cookies.put("session", data.mandate.session);

		                    	////console.log("GO TO "+data.mandate.link);

		                    	window.location = data.mandate.link;


		                    } else {
		                    	ToastService.error('Signup Error', 'An error occurred: ' + data.error);
		                    	return false;
		                    }
		            });

	            } else {
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
		    		if(!$scope.formData.nok){
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

		    $scope.sendVerification = function(){
		    	var user_id = $cookies.get("uid");

		    	MemberService.VerifyInvitedUser(user_id)
		                .then(function (data) {
		                    // //console.log(data);
		                    if(data.success){
		                        //use GB airfields first...
		                        //$scope.verified_mobile = true;

		                        // $scope.link = data.link.url;
		                    	// $cookies.put('mid', last);
		                    	// $cookies.put('bid', data.bid);

		                    	$state.go("invitations.verified");



		                    } else {
		                    	ToastService.error('Verification Failed', 'Your verification code is incorrect.');
		                    }

		                });
		    }


		    function sendVerification(){

		    	var user_id = $cookies.get("uid");

		    	MemberService.VerifyInvitedUser(user_id)
		                .then(function (data) {
		                    // //console.log(data);
		                    if(data.success){
		                        //use GB airfields first...
		                        //$scope.verified_mobile = true;

		                        // $scope.link = data.link.url;
		                    	// $cookies.put('mid', last);
		                    	// $cookies.put('bid', data.bid);

		                    	$state.go("invitations.verified");



		                    } else {
		                    	ToastService.error('Verification Failed', 'Your verification code is incorrect.');
    							//$scope.verified_mobile = false;
		                    }

		                });

		    }


		    $scope.verify_mobile = function(value){
		    	var val = value.text_verification;
    			////console.log("called", value.text_verification);
    			////console.log("called", $scope.text_verification);

    			if(val.length == 6){
    				//then we check

    				// //console.log("4 chars", vm.text_verification);
    				// //console.log("4 chars", last);

    				//VerifyInvitedUser

    				MemberService.VerifyPhoneInvite(val, $cookies.get("uid"))
		                .then(function (data) {
		                    // //console.log(data);
		                    if(data && data.success){
		                        //use GB airfields first...
		                        $scope.verified_mobile = true;

		                        //$scope.link = data.link.url;
		                    	// $cookies.put('mid', last);
		                    	// $cookies.put('bid', data.bid);




		                    } else {
		                    	ToastService.error('Verification Failed', 'Your verification code is incorrect.');
		                    }

		                });

    				// if(text_verification == "1234"){

    				// 	$scope.verified_mobile = true;
    				// }

    			} else {
    				//do nothing
    			}

    		}

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
		        
		    	//basic checks of what is being sent should be added here....
		        UserService.InviteSignup($scope.formData)
	                .then(function (data) {
		    			//console.log("INVITATION BEING SENT NOW...", data);


	                    if(data){
	                    	//console.log("success");
	                    	ToastService.success('Success', 'All good to go!');
	                    	$state.go("invitations.verified");
	                    } else {
	                    	ToastService.error('Invitation Not Found', 'Sorry we were unable to find this invitation. Please try clicking the link again.')
	                    	$state.go("login");
	                    }
	                });








		    };

    }