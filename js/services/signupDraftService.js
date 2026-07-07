app.factory('SignupDraftService', SignupDraftService);

    SignupDraftService.$inject = ['$timeout'];
    function SignupDraftService($timeout) {

        // Auto-saves in-progress signup form data to localStorage so an
        // accidental refresh, closed tab, or browser back/forward never loses
        // what the user has typed. Passwords, verification codes and
        // terms-acceptance ticks are NEVER stored — they must always be
        // re-entered / re-confirmed.

        var PREFIX = 'toaviate_signup_draft_';
        var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // drafts expire after 7 days
        var DEBOUNCE_MS = 800;

        // Keys stripped (recursively) before anything is written to storage.
        var SENSITIVE_KEYS = [
            'password', 'password2', 'formcode',
            'stripe_setup_secret',
            'tnc', 'club_tnc', 'membership_tnc', 'payment'
        ];

        var service = {};
        service.Load = Load;
        service.Save = Save;
        service.Clear = Clear;
        service.Watch = Watch;
        return service;

        function storageKey(flowKey) {
            return PREFIX + flowKey;
        }

        // Deep-copy `value` with sensitive keys removed. Only handles plain
        // objects/arrays/primitives — Dates are serialised by JSON anyway.
        function sanitize(value) {
            if (angular.isArray(value)) {
                var arr = [];
                for (var i = 0; i < value.length; i++) {
                    arr.push(sanitize(value[i]));
                }
                return arr;
            }
            if (value instanceof Date) {
                return value;
            }
            if (angular.isObject(value)) {
                var out = {};
                for (var key in value) {
                    if (!value.hasOwnProperty(key)) { continue; }
                    if (key.charAt(0) === '$') { continue; } // angular internals
                    if (SENSITIVE_KEYS.indexOf(key) > -1) { continue; }
                    out[key] = sanitize(value[key]);
                }
                return out;
            }
            return value;
        }

        function Save(flowKey, data) {
            try {
                var record = {
                    saved_at: new Date().getTime(),
                    data: sanitize(data)
                };
                localStorage.setItem(storageKey(flowKey), JSON.stringify(record));
            } catch (e) {
                // Storage full / private mode — auto-save is best-effort only.
            }
        }

        function Load(flowKey) {
            try {
                var raw = localStorage.getItem(storageKey(flowKey));
                if (!raw) { return null; }
                var record = JSON.parse(raw);
                if (!record || !record.data) { return null; }
                if (new Date().getTime() - (record.saved_at || 0) > MAX_AGE_MS) {
                    Clear(flowKey);
                    return null;
                }
                return record.data;
            } catch (e) {
                return null;
            }
        }

        function Clear(flowKey) {
            try {
                localStorage.removeItem(storageKey(flowKey));
            } catch (e) {}
        }

        // Deep-watch `getter()` on the given scope and auto-save (debounced).
        // Returns the deregistration function should a controller need it.
        function Watch(scope, flowKey, getter) {
            var pending = null;
            var unwatch = scope.$watch(getter, function (value, old) {
                if (value === undefined) { return; }
                if (pending) { $timeout.cancel(pending); }
                pending = $timeout(function () {
                    pending = null;
                    Save(flowKey, value);
                }, DEBOUNCE_MS);
            }, true);
            scope.$on('$destroy', function () {
                if (pending) { $timeout.cancel(pending); }
            });
            return unwatch;
        }
    }
