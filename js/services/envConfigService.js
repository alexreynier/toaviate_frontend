    /**
     * Environment Configuration Service
     * 
     * Centralises all environment-specific settings (API keys, feature flags, etc.)
     * Change the 'environment' variable below to switch between dev/staging/production.
     * 
     * During the grunt build, you can swap this file or use grunt-string-replace 
     * to set the environment to 'production' automatically.
     */
    app.factory('EnvConfig', EnvConfig);

    EnvConfig.$inject = [];
    function EnvConfig() {

        // =============================================
        // SET YOUR ENVIRONMENT HERE
        // =============================================
        var environment = 'development'; // 'development' | 'staging' | 'production'

        var configs = {

            // NOTE: no Stripe keys here. Stripe publishable keys are per-club AND
            // per payment mode, fetched at runtime via
            // PaymentService.GetClubStripeKey(club_id) — never hard-coded.
            development: {
                api_base_url: 'https://local-api.toaviate.com',
                api_key: 'eW91a25vd25vdGhpbmdqb25zbm93',
                // Flight replay map provider: 'maplibre' (free, no key) | 'google'.
                map_provider: 'maplibre',
                // Google Maps JS API key — only needed when map_provider is 'google'.
                // Restrict by HTTP referrer in the Google Cloud console. Fill in per env.
                google_maps_key: 'REPLACE_WITH_GOOGLE_MAPS_KEY',
                // Optional MapLibre vector style URL (else a free OSM raster style
                // is used). A keyed style (MapTiler etc.) can go here later.
                maplibre_style_url: '',
                debug: true
            },

            staging: {
                api_base_url: 'https://v1.toaviate.com',
                api_key: 'eW91a25vd25vdGhpbmdqb25zbm93',
                map_provider: 'maplibre',
                google_maps_key: 'REPLACE_WITH_GOOGLE_MAPS_KEY',
                maplibre_style_url: '',
                debug: false
            },

            production: {
                api_base_url: 'https://api.toaviate.com',
                api_key: 'eW91a25vd25vdGhpbmdqb25zbm93',
                map_provider: 'maplibre',
                google_maps_key: 'REPLACE_WITH_GOOGLE_MAPS_KEY',
                maplibre_style_url: '',
                debug: false
            }
        };

        var active = configs[environment] || configs.development;

        return {
            get: function(key) {
                return active[key];
            },
            getEnvironment: function() {
                return environment;
            },
            isProduction: function() {
                return environment === 'production';
            },
            isDebug: function() {
                return active.debug;
            },
            getApiKey: function() {
                return active.api_key;
            },
            getApiBaseUrl: function() {
                return active.api_base_url;
            },
            getGoogleMapsKey: function() {
                return active.google_maps_key;
            },
            getMapProvider: function() {
                return active.map_provider || 'maplibre';
            },
            getMapLibreStyleUrl: function() {
                return active.maplibre_style_url || '';
            }
        };
    }
