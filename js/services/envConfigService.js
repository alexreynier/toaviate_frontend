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

            development: {
                api_base_url: 'https://local-api.toaviate.com',
                stripe_publishable_key: 'pk_test_51QttFFG8WiGSRCORyxkdZTO8oajcqz9OUsvcDJFpr9FB2PAdbzJc0tS7WNnfzKYsTiqHN1YDZi5UtXk4K52SeD4h00YWXuChNd',
                stripe_publishable_key_legacy: 'pk_test_Ers4ZfdIMZ59ac4wKy6FDAH2',
                api_key: 'eW91a25vd25vdGhpbmdqb25zbm93',
                debug: true
            },

            staging: {
                api_base_url: 'https://staging-api.toaviate.com',
                stripe_publishable_key: 'pk_test_51QttFFG8WiGSRCORyxkdZTO8oajcqz9OUsvcDJFpr9FB2PAdbzJc0tS7WNnfzKYsTiqHN1YDZi5UtXk4K52SeD4h00YWXuChNd',
                stripe_publishable_key_legacy: 'pk_test_Ers4ZfdIMZ59ac4wKy6FDAH2',
                api_key: 'eW91a25vd25vdGhpbmdqb25zbm93',
                debug: true
            },

            production: {
                api_base_url: 'https://api.toaviate.com',
                stripe_publishable_key: 'REPLACE_WITH_LIVE_STRIPE_KEY',
                stripe_publishable_key_legacy: 'REPLACE_WITH_LIVE_STRIPE_KEY_LEGACY',
                api_key: 'eW91a25vd25vdGhpbmdqb25zbm93',
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
            getStripeKey: function() {
                return active.stripe_publishable_key;
            },
            getStripeKeyLegacy: function() {
                return active.stripe_publishable_key_legacy;
            },
            getApiKey: function() {
                return active.api_key;
            },
            getApiBaseUrl: function() {
                return active.api_base_url;
            }
        };
    }
