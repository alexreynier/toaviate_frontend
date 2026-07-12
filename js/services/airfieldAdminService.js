// ═══════════════════════════════════════════════════════════════════
//  AirfieldAdminService
//  ToAviate super-admin management of the global airfield database:
//    – Dashboard / coverage status
//    – Import a country or a map area from OurAirports
//    – Review queue (co-located duplicates + auto-imported rows)
//    – Manual CRUD on individual airfields
//    – Search over the existing airfield table
//  Backend contract: FRONTEND_AIRFIELD_IMPORT_ADMIN_GUIDE.md
// ═══════════════════════════════════════════════════════════════════

app.factory('AirfieldAdminService', AirfieldAdminService);

AirfieldAdminService.$inject = ['$http', '$location', 'EnvConfig'];
function AirfieldAdminService($http, $location, EnvConfig) {

    // The public airfield search endpoints (/airfields/*) use the same relaxed
    // headers as the bookout form rather than the admin session headers.
    var siteOrigin = window.location.origin;
    var airfieldSearchHeaders = {
        'Api-Key': EnvConfig.getApiKey(),
        'Authorization': 'Basic aGVyZWJlOmRyYWdvbnM=',
        'X-Origin': siteOrigin,
        'X-Referer': siteOrigin + '/'
    };

    var service = {};

    service.GetStatus       = GetStatus;
    service.ImportCountry   = ImportCountry;
    service.ImportArea      = ImportArea;
    service.GetReview       = GetReview;
    service.ApproveReview   = ApproveReview;
    service.DismissReview   = DismissReview;
    service.CreateAirfield  = CreateAirfield;
    service.UpdateAirfield  = UpdateAirfield;
    service.DeleteAirfield  = DeleteAirfield;
    service.SearchAirfields = SearchAirfields;
    service.GetAirfield     = GetAirfield;

    // Reference data used by the views (country names, airfield types).
    service.countries = COUNTRIES;
    service.af_types  = AF_TYPES;
    service.countryName = countryName;

    return service;

    // ── Dashboard ──
    function GetStatus() {
        return $http.get('/api/v1/airfield_import/status').then(handleSuccess, handleError2);
    }

    // ── Imports ──
    function ImportCountry(iso) {
        return $http.post('/api/v1/airfield_import/country', { iso: iso })
            .then(handleSuccess, handleError2);
    }

    function ImportArea(lat, lon, box) {
        return $http.post('/api/v1/airfield_import/area', { lat: lat, lon: lon, box: box })
            .then(handleSuccess, handleError2);
    }

    // ── Review queue ──
    function GetReview(status) {
        return $http.get('/api/v1/airfield_import/review?status=' + (status || 'pending'))
            .then(handleSuccess, handleError2);
    }

    function ApproveReview(id) {
        return $http.post('/api/v1/airfield_import/review/' + id + '/approve', {})
            .then(handleSuccess, handleError2);
    }

    function DismissReview(id) {
        return $http.post('/api/v1/airfield_import/review/' + id + '/dismiss', {})
            .then(handleSuccess, handleError2);
    }

    // ── Manual CRUD ──
    function CreateAirfield(airfield) {
        return $http.post('/api/v1/airfield_import/airfield', airfield)
            .then(handleSuccess, handleError2);
    }

    function UpdateAirfield(id, airfield) {
        return $http.put('/api/v1/airfield_import/airfield/' + id, airfield)
            .then(handleSuccess, handleError2);
    }

    function DeleteAirfield(id) {
        return $http.delete('/api/v1/airfield_import/airfield/' + id)
            .then(handleSuccess, handleError2);
    }

    // ── Search (existing public endpoints) ──
    function SearchAirfields(query) {
        return $http.get('/api/v1/airfields/all/' + encodeURIComponent(query),
            { headers: airfieldSearchHeaders }).then(handleSuccess, handleError2);
    }

    function GetAirfield(id) {
        return $http.get('/api/v1/airfields/' + id, { headers: airfieldSearchHeaders })
            .then(handleSuccess, handleError2);
    }

    // ── Helpers ──
    function countryName(code) {
        if (!code) { return ''; }
        var c = COUNTRIES_BY_CODE[String(code).toUpperCase()];
        return c ? c.name : code;
    }

    function handleSuccess(res) {
        return res.data;
    }

    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        return { success: false, message: res.data, status: res.status };
    }
}

// ── Airfield types (backend `af_type` enum) ──
var AF_TYPES = [
    { value: 'large_airport',  label: 'Large airport',  icon: 'fa-plane-departure' },
    { value: 'medium_airport', label: 'Medium airport', icon: 'fa-plane' },
    { value: 'small_airport',  label: 'Small airport',  icon: 'fa-paper-plane' },
    { value: 'seaplane_base',  label: 'Seaplane base',  icon: 'fa-water' },
    { value: 'heliport',       label: 'Heliport',       icon: 'fa-helicopter' },
    { value: 'balloonport',    label: 'Balloonport',    icon: 'fa-hot-tub' },
    { value: 'closed',         label: 'Closed',         icon: 'fa-ban' }
];

// ── ISO 3166-1 alpha-2 country list (code + name + flag emoji) ──
// Used by the country picker and to label the coverage table.
var COUNTRIES = [
    {code:'AF',name:'Afghanistan',flag:'🇦🇫'},{code:'AL',name:'Albania',flag:'🇦🇱'},{code:'DZ',name:'Algeria',flag:'🇩🇿'},
    {code:'AD',name:'Andorra',flag:'🇦🇩'},{code:'AO',name:'Angola',flag:'🇦🇴'},{code:'AG',name:'Antigua and Barbuda',flag:'🇦🇬'},
    {code:'AR',name:'Argentina',flag:'🇦🇷'},{code:'AM',name:'Armenia',flag:'🇦🇲'},{code:'AW',name:'Aruba',flag:'🇦🇼'},
    {code:'AU',name:'Australia',flag:'🇦🇺'},{code:'AT',name:'Austria',flag:'🇦🇹'},{code:'AZ',name:'Azerbaijan',flag:'🇦🇿'},
    {code:'BS',name:'Bahamas',flag:'🇧🇸'},{code:'BH',name:'Bahrain',flag:'🇧🇭'},{code:'BD',name:'Bangladesh',flag:'🇧🇩'},
    {code:'BB',name:'Barbados',flag:'🇧🇧'},{code:'BY',name:'Belarus',flag:'🇧🇾'},{code:'BE',name:'Belgium',flag:'🇧🇪'},
    {code:'BZ',name:'Belize',flag:'🇧🇿'},{code:'BJ',name:'Benin',flag:'🇧🇯'},{code:'BM',name:'Bermuda',flag:'🇧🇲'},
    {code:'BT',name:'Bhutan',flag:'🇧🇹'},{code:'BO',name:'Bolivia',flag:'🇧🇴'},{code:'BA',name:'Bosnia and Herzegovina',flag:'🇧🇦'},
    {code:'BW',name:'Botswana',flag:'🇧🇼'},{code:'BR',name:'Brazil',flag:'🇧🇷'},{code:'BN',name:'Brunei',flag:'🇧🇳'},
    {code:'BG',name:'Bulgaria',flag:'🇧🇬'},{code:'BF',name:'Burkina Faso',flag:'🇧🇫'},{code:'BI',name:'Burundi',flag:'🇧🇮'},
    {code:'KH',name:'Cambodia',flag:'🇰🇭'},{code:'CM',name:'Cameroon',flag:'🇨🇲'},{code:'CA',name:'Canada',flag:'🇨🇦'},
    {code:'CV',name:'Cape Verde',flag:'🇨🇻'},{code:'KY',name:'Cayman Islands',flag:'🇰🇾'},{code:'CF',name:'Central African Republic',flag:'🇨🇫'},
    {code:'TD',name:'Chad',flag:'🇹🇩'},{code:'CL',name:'Chile',flag:'🇨🇱'},{code:'CN',name:'China',flag:'🇨🇳'},
    {code:'CO',name:'Colombia',flag:'🇨🇴'},{code:'KM',name:'Comoros',flag:'🇰🇲'},{code:'CG',name:'Congo',flag:'🇨🇬'},
    {code:'CD',name:'Congo (DRC)',flag:'🇨🇩'},{code:'CR',name:'Costa Rica',flag:'🇨🇷'},{code:'CI',name:"Côte d'Ivoire",flag:'🇨🇮'},
    {code:'HR',name:'Croatia',flag:'🇭🇷'},{code:'CU',name:'Cuba',flag:'🇨🇺'},{code:'CY',name:'Cyprus',flag:'🇨🇾'},
    {code:'CZ',name:'Czechia',flag:'🇨🇿'},{code:'DK',name:'Denmark',flag:'🇩🇰'},{code:'DJ',name:'Djibouti',flag:'🇩🇯'},
    {code:'DM',name:'Dominica',flag:'🇩🇲'},{code:'DO',name:'Dominican Republic',flag:'🇩🇴'},{code:'EC',name:'Ecuador',flag:'🇪🇨'},
    {code:'EG',name:'Egypt',flag:'🇪🇬'},{code:'SV',name:'El Salvador',flag:'🇸🇻'},{code:'GQ',name:'Equatorial Guinea',flag:'🇬🇶'},
    {code:'ER',name:'Eritrea',flag:'🇪🇷'},{code:'EE',name:'Estonia',flag:'🇪🇪'},{code:'SZ',name:'Eswatini',flag:'🇸🇿'},
    {code:'ET',name:'Ethiopia',flag:'🇪🇹'},{code:'FO',name:'Faroe Islands',flag:'🇫🇴'},{code:'FJ',name:'Fiji',flag:'🇫🇯'},
    {code:'FI',name:'Finland',flag:'🇫🇮'},{code:'FR',name:'France',flag:'🇫🇷'},{code:'GF',name:'French Guiana',flag:'🇬🇫'},
    {code:'PF',name:'French Polynesia',flag:'🇵🇫'},{code:'GA',name:'Gabon',flag:'🇬🇦'},{code:'GM',name:'Gambia',flag:'🇬🇲'},
    {code:'GE',name:'Georgia',flag:'🇬🇪'},{code:'DE',name:'Germany',flag:'🇩🇪'},{code:'GH',name:'Ghana',flag:'🇬🇭'},
    {code:'GI',name:'Gibraltar',flag:'🇬🇮'},{code:'GR',name:'Greece',flag:'🇬🇷'},{code:'GL',name:'Greenland',flag:'🇬🇱'},
    {code:'GD',name:'Grenada',flag:'🇬🇩'},{code:'GP',name:'Guadeloupe',flag:'🇬🇵'},{code:'GU',name:'Guam',flag:'🇬🇺'},
    {code:'GT',name:'Guatemala',flag:'🇬🇹'},{code:'GG',name:'Guernsey',flag:'🇬🇬'},{code:'GN',name:'Guinea',flag:'🇬🇳'},
    {code:'GW',name:'Guinea-Bissau',flag:'🇬🇼'},{code:'GY',name:'Guyana',flag:'🇬🇾'},{code:'HT',name:'Haiti',flag:'🇭🇹'},
    {code:'HN',name:'Honduras',flag:'🇭🇳'},{code:'HK',name:'Hong Kong',flag:'🇭🇰'},{code:'HU',name:'Hungary',flag:'🇭🇺'},
    {code:'IS',name:'Iceland',flag:'🇮🇸'},{code:'IN',name:'India',flag:'🇮🇳'},{code:'ID',name:'Indonesia',flag:'🇮🇩'},
    {code:'IR',name:'Iran',flag:'🇮🇷'},{code:'IQ',name:'Iraq',flag:'🇮🇶'},{code:'IE',name:'Ireland',flag:'🇮🇪'},
    {code:'IM',name:'Isle of Man',flag:'🇮🇲'},{code:'IL',name:'Israel',flag:'🇮🇱'},{code:'IT',name:'Italy',flag:'🇮🇹'},
    {code:'JM',name:'Jamaica',flag:'🇯🇲'},{code:'JP',name:'Japan',flag:'🇯🇵'},{code:'JE',name:'Jersey',flag:'🇯🇪'},
    {code:'JO',name:'Jordan',flag:'🇯🇴'},{code:'KZ',name:'Kazakhstan',flag:'🇰🇿'},{code:'KE',name:'Kenya',flag:'🇰🇪'},
    {code:'KI',name:'Kiribati',flag:'🇰🇮'},{code:'KW',name:'Kuwait',flag:'🇰🇼'},{code:'KG',name:'Kyrgyzstan',flag:'🇰🇬'},
    {code:'LA',name:'Laos',flag:'🇱🇦'},{code:'LV',name:'Latvia',flag:'🇱🇻'},{code:'LB',name:'Lebanon',flag:'🇱🇧'},
    {code:'LS',name:'Lesotho',flag:'🇱🇸'},{code:'LR',name:'Liberia',flag:'🇱🇷'},{code:'LY',name:'Libya',flag:'🇱🇾'},
    {code:'LI',name:'Liechtenstein',flag:'🇱🇮'},{code:'LT',name:'Lithuania',flag:'🇱🇹'},{code:'LU',name:'Luxembourg',flag:'🇱🇺'},
    {code:'MO',name:'Macao',flag:'🇲🇴'},{code:'MG',name:'Madagascar',flag:'🇲🇬'},{code:'MW',name:'Malawi',flag:'🇲🇼'},
    {code:'MY',name:'Malaysia',flag:'🇲🇾'},{code:'MV',name:'Maldives',flag:'🇲🇻'},{code:'ML',name:'Mali',flag:'🇲🇱'},
    {code:'MT',name:'Malta',flag:'🇲🇹'},{code:'MH',name:'Marshall Islands',flag:'🇲🇭'},{code:'MQ',name:'Martinique',flag:'🇲🇶'},
    {code:'MR',name:'Mauritania',flag:'🇲🇷'},{code:'MU',name:'Mauritius',flag:'🇲🇺'},{code:'MX',name:'Mexico',flag:'🇲🇽'},
    {code:'FM',name:'Micronesia',flag:'🇫🇲'},{code:'MD',name:'Moldova',flag:'🇲🇩'},{code:'MC',name:'Monaco',flag:'🇲🇨'},
    {code:'MN',name:'Mongolia',flag:'🇲🇳'},{code:'ME',name:'Montenegro',flag:'🇲🇪'},{code:'MA',name:'Morocco',flag:'🇲🇦'},
    {code:'MZ',name:'Mozambique',flag:'🇲🇿'},{code:'MM',name:'Myanmar',flag:'🇲🇲'},{code:'NA',name:'Namibia',flag:'🇳🇦'},
    {code:'NP',name:'Nepal',flag:'🇳🇵'},{code:'NL',name:'Netherlands',flag:'🇳🇱'},{code:'NC',name:'New Caledonia',flag:'🇳🇨'},
    {code:'NZ',name:'New Zealand',flag:'🇳🇿'},{code:'NI',name:'Nicaragua',flag:'🇳🇮'},{code:'NE',name:'Niger',flag:'🇳🇪'},
    {code:'NG',name:'Nigeria',flag:'🇳🇬'},{code:'MK',name:'North Macedonia',flag:'🇲🇰'},{code:'NO',name:'Norway',flag:'🇳🇴'},
    {code:'OM',name:'Oman',flag:'🇴🇲'},{code:'PK',name:'Pakistan',flag:'🇵🇰'},{code:'PW',name:'Palau',flag:'🇵🇼'},
    {code:'PS',name:'Palestine',flag:'🇵🇸'},{code:'PA',name:'Panama',flag:'🇵🇦'},{code:'PG',name:'Papua New Guinea',flag:'🇵🇬'},
    {code:'PY',name:'Paraguay',flag:'🇵🇾'},{code:'PE',name:'Peru',flag:'🇵🇪'},{code:'PH',name:'Philippines',flag:'🇵🇭'},
    {code:'PL',name:'Poland',flag:'🇵🇱'},{code:'PT',name:'Portugal',flag:'🇵🇹'},{code:'PR',name:'Puerto Rico',flag:'🇵🇷'},
    {code:'QA',name:'Qatar',flag:'🇶🇦'},{code:'RE',name:'Réunion',flag:'🇷🇪'},{code:'RO',name:'Romania',flag:'🇷🇴'},
    {code:'RU',name:'Russia',flag:'🇷🇺'},{code:'RW',name:'Rwanda',flag:'🇷🇼'},{code:'WS',name:'Samoa',flag:'🇼🇸'},
    {code:'SM',name:'San Marino',flag:'🇸🇲'},{code:'SA',name:'Saudi Arabia',flag:'🇸🇦'},{code:'SN',name:'Senegal',flag:'🇸🇳'},
    {code:'RS',name:'Serbia',flag:'🇷🇸'},{code:'SC',name:'Seychelles',flag:'🇸🇨'},{code:'SL',name:'Sierra Leone',flag:'🇸🇱'},
    {code:'SG',name:'Singapore',flag:'🇸🇬'},{code:'SK',name:'Slovakia',flag:'🇸🇰'},{code:'SI',name:'Slovenia',flag:'🇸🇮'},
    {code:'SB',name:'Solomon Islands',flag:'🇸🇧'},{code:'SO',name:'Somalia',flag:'🇸🇴'},{code:'ZA',name:'South Africa',flag:'🇿🇦'},
    {code:'KR',name:'South Korea',flag:'🇰🇷'},{code:'SS',name:'South Sudan',flag:'🇸🇸'},{code:'ES',name:'Spain',flag:'🇪🇸'},
    {code:'LK',name:'Sri Lanka',flag:'🇱🇰'},{code:'SD',name:'Sudan',flag:'🇸🇩'},{code:'SR',name:'Suriname',flag:'🇸🇷'},
    {code:'SE',name:'Sweden',flag:'🇸🇪'},{code:'CH',name:'Switzerland',flag:'🇨🇭'},{code:'SY',name:'Syria',flag:'🇸🇾'},
    {code:'TW',name:'Taiwan',flag:'🇹🇼'},{code:'TJ',name:'Tajikistan',flag:'🇹🇯'},{code:'TZ',name:'Tanzania',flag:'🇹🇿'},
    {code:'TH',name:'Thailand',flag:'🇹🇭'},{code:'TL',name:'Timor-Leste',flag:'🇹🇱'},{code:'TG',name:'Togo',flag:'🇹🇬'},
    {code:'TO',name:'Tonga',flag:'🇹🇴'},{code:'TT',name:'Trinidad and Tobago',flag:'🇹🇹'},{code:'TN',name:'Tunisia',flag:'🇹🇳'},
    {code:'TR',name:'Türkiye',flag:'🇹🇷'},{code:'TM',name:'Turkmenistan',flag:'🇹🇲'},{code:'UG',name:'Uganda',flag:'🇺🇬'},
    {code:'UA',name:'Ukraine',flag:'🇺🇦'},{code:'AE',name:'United Arab Emirates',flag:'🇦🇪'},{code:'GB',name:'United Kingdom',flag:'🇬🇧'},
    {code:'US',name:'United States',flag:'🇺🇸'},{code:'UY',name:'Uruguay',flag:'🇺🇾'},{code:'UZ',name:'Uzbekistan',flag:'🇺🇿'},
    {code:'VU',name:'Vanuatu',flag:'🇻🇺'},{code:'VA',name:'Vatican City',flag:'🇻🇦'},{code:'VE',name:'Venezuela',flag:'🇻🇪'},
    {code:'VN',name:'Vietnam',flag:'🇻🇳'},{code:'VG',name:'Virgin Islands (British)',flag:'🇻🇬'},{code:'VI',name:'Virgin Islands (US)',flag:'🇻🇮'},
    {code:'YE',name:'Yemen',flag:'🇾🇪'},{code:'ZM',name:'Zambia',flag:'🇿🇲'},{code:'ZW',name:'Zimbabwe',flag:'🇿🇼'}
];

var COUNTRIES_BY_CODE = (function () {
    var map = {};
    for (var i = 0; i < COUNTRIES.length; i++) {
        map[COUNTRIES[i].code] = COUNTRIES[i];
    }
    return map;
})();
