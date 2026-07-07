app.factory('PasswordPolicyService', PasswordPolicyService);

    PasswordPolicyService.$inject = [];
    function PasswordPolicyService() {

        // Single source of truth for the signup password policy:
        // at least 8 characters, an uppercase letter, a lowercase letter,
        // a number and a special character. Every signup flow validates
        // against this and shows the SAME per-rule feedback, so the user is
        // told exactly which requirement is missing instead of a generic
        // "missing fields" error.

        var service = {};
        service.Rules = Rules;
        service.Problems = Problems;
        service.Message = Message;
        return service;

        // Per-rule pass/fail — used by the live checklist under the field.
        function Rules(pw) {
            pw = String(pw || '');
            var r = {
                len:     pw.length >= 8,
                upper:   /[A-Z]/.test(pw),
                lower:   /[a-z]/.test(pw),
                number:  /[0-9]/.test(pw),
                special: /[^A-Za-z0-9]/.test(pw)
            };
            r.all = r.len && r.upper && r.lower && r.number && r.special;
            return r;
        }

        // Human descriptions of ONLY the failing rules.
        function Problems(pw) {
            var r = Rules(pw);
            var out = [];
            if (!r.len)     { out.push('at least 8 characters'); }
            if (!r.upper)   { out.push('an uppercase letter'); }
            if (!r.lower)   { out.push('a lowercase letter'); }
            if (!r.number)  { out.push('a number'); }
            if (!r.special) { out.push('a special character (e.g. ! ? #)'); }
            return out;
        }

        // One readable sentence naming exactly what is still missing,
        // e.g. "Your password still needs a number and a special character (e.g. ! ? #)."
        function Message(pw) {
            var p = Problems(pw);
            if (!p.length) { return ''; }
            var joined = p.length === 1 ? p[0]
                : p.slice(0, -1).join(', ') + ' and ' + p[p.length - 1];
            return 'Your password still needs ' + joined + '.';
        }
    }
