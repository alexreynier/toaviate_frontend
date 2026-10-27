// ═══════════════════════════════════════════════════════════════════
//  AdminEmailRecoveryController
//  ToAviate super-admin → Account Security → "Email recovery" and
//  "Security events" cards (views/manageclub/super_admin_security.html).
//
//  Bound as   ng-controller="AdminEmailRecoveryController as rec"   on a
//  plain wrapper div (never on the same element as an ng-if — this
//  repo's Angular silently skips the controller then).
//
//  Flow (ACCOUNT_EMAILS_DESIGN.md §4): the admin opens a case, the member
//  proves control of the new address (link + SMS if they have a verified
//  phone), the old address can veto, and the swap completes after a 24 h
//  hold OR when a second, different admin approves (FOUR_EYES).
//
//  Every mutating call goes through StepUpService.Run(purpose
//  'admin_recovery') — the write starts after the step-up modal, so the
//  app-wide busy guard can't see it and each action keeps its own flag.
//
//  Backend contract: BACKEND_ACCOUNT_EMAILS_PLAN.md §5.4,
//                    FRONTEND_ACCOUNT_EMAILS_PLAN.md §5.
// ═══════════════════════════════════════════════════════════════════

app.controller('AdminEmailRecoveryController', AdminEmailRecoveryController);

AdminEmailRecoveryController.$inject = ['AccountEmailsService', 'StepUpService', 'ToastService',
                                        '$rootScope'];
function AdminEmailRecoveryController(AccountEmailsService, StepUpService, ToastService,
                                      $rootScope) {
    var rec = this;

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // ── Who am I (four-eyes: I can't approve a case I opened) ──
    rec.user     = $rootScope.globals.currentUser;
    rec.myId     = parseInt(rec.user && rec.user.id, 10) || 0;
    rec.is_staff = $rootScope.isToAviateStaff();

    // Gate state — ADMIN_2FA_REQUIRED from ANY call shows the banner and hides the form
    rec.needs2fa  = false;
    rec.forbidden = false;

    // ── 1. Find the account ──
    rec.query       = '';
    rec.lookupBusy  = false;
    rec.found       = null;      // AdminLookup().user
    rec.lookupMiss  = '';        // "no account matches …"
    rec.lookup      = lookup;
    rec.clearLookup = clearLookup;

    // ── 2. Open a recovery request ──
    rec.CHECKS = [
        { key: 'phone_callback', label: 'Called the phone number on file and spoke to the member' },
        { key: 'club_manager',   label: 'Club manager confirmed the request' },
        { key: 'id_document',    label: 'Photo ID matched the account name' }
    ];
    rec.form         = blankForm();
    rec.opening      = false;
    rec.toggleCheck  = toggleCheck;
    rec.checkedCount = checkedCount;
    rec.openRequest  = openRequest;

    // ── 3. Open / recent requests ──
    rec.casesLoading = false;
    rec.casesLoaded  = false;
    rec.open         = [];
    rec.recent       = [];
    rec.showRecent   = false;
    rec.busy         = {};       // case id → true while approve/cancel is in flight
    rec.cancelDraft  = {};       // case id → { reason: '' } while the inline reason box is open
    rec.loadCases     = loadCases;
    rec.statusLabel   = statusLabel;
    rec.statusClass   = statusClass;
    rec.statusDetail  = statusDetail;
    rec.canApprove    = canApprove;
    rec.approve       = approve;
    rec.askCancel     = function (c) { rec.cancelDraft[c.id] = { reason: '' }; };
    rec.dismissCancel = function (c) { delete rec.cancelDraft[c.id]; };
    rec.confirmCancel = confirmCancel;
    rec.openerName    = openerName;
    rec.approverName  = approverName;
    rec.caseUser      = caseUser;
    rec.isMine        = isMine;

    // ── 4. Security events ──
    rec.eventsUserId = '';
    rec.eventsBusy   = false;
    rec.eventsLoaded = false;
    rec.events       = [];
    rec.loadEvents   = loadEvents;
    rec.eventsFor    = function (user) { rec.eventsUserId = String(user.id); loadEvents(); };
    rec.detailsText  = detailsText;
    rec.toggleEvent  = function (e) { e._open = !e._open; };

    // ── Formatting helpers (shared by both cards) ──
    rec.fmt      = function (s) { var m = parse(s); return m ? m.format('D MMM YYYY HH:mm') : '—'; };
    rec.ago      = function (s) { var m = parse(s); return m ? m.fromNow() : ''; };
    rec.fullName = fullName;
    rec.yesNo    = function (v) { return isTruthy(v) ? 'Yes' : 'No'; };
    rec.isTruthy = isTruthy;

    if (rec.is_staff) {
        loadCases();
    }

    // ═══════════════════════════════════════════════════════════════
    //  1. Lookup
    // ═══════════════════════════════════════════════════════════════

    var lookupSeq = 0;

    function lookup() {
        var q = (rec.query || '').toString().trim();
        rec.lookupMiss = '';
        if (!q) {
            rec.found = null;
            return;
        }
        // Debounced from the input: wait for something lookup-able
        // (a numeric id, or at least 3 characters of an address).
        if (!/^\d+$/.test(q) && q.length < 3) { return; }

        var seq = ++lookupSeq;
        rec.lookupBusy = true;
        AccountEmailsService.AdminLookup(q).then(function (data) {
            if (seq !== lookupSeq) { return; }       // a newer lookup superseded this one
            rec.lookupBusy = false;
            var code = errorCode(data);
            if (code === 'NOT_FOUND' || (data && data.success !== false && !data.user)) {
                rec.found = null;
                rec.lookupMiss = 'No account matches "' + q + '".';
                return;
            }
            if (handleError(data, 'Lookup Failed')) {
                rec.found = null;
                return;
            }
            rec.found = normaliseUser(data.user);
            rec.form  = blankForm();
        });
    }

    function clearLookup() {
        lookupSeq++;
        rec.query      = '';
        rec.found      = null;
        rec.lookupMiss = '';
        rec.lookupBusy = false;
        rec.form       = blankForm();
    }

    function normaliseUser(u) {
        u = u || {};
        u.addresses = angular.isArray(u.addresses) ? u.addresses : [];
        u.clubs     = (angular.isArray(u.clubs) ? u.clubs : []).map(function (c) {
            if (c && c.club_name && !c.name) { c.name = c.club_name; }
            if (c && c.club_id && !c.id) { c.id = c.club_id; }
            return c;
        });
        u.passkeys  = parseInt(u.passkeys, 10) || 0;
        if (u.open_case && !u.open_case.id) { u.open_case = null; }
        return u;
    }

    // ═══════════════════════════════════════════════════════════════
    //  2. Open a recovery request
    // ═══════════════════════════════════════════════════════════════

    function blankForm() {
        return { new_email: '', notes: '', checks: {} };
    }

    function toggleCheck(key) {
        rec.form.checks[key] = !rec.form.checks[key];
    }

    function checkedKeys() {
        var keys = [];
        for (var i = 0; i < rec.CHECKS.length; i++) {
            if (rec.form.checks[rec.CHECKS[i].key]) { keys.push(rec.CHECKS[i].key); }
        }
        return keys;
    }

    function checkedCount() {
        return checkedKeys().length;
    }

    function openRequest() {
        if (rec.opening || rec.needs2fa) { return; }
        if (!rec.found || !rec.found.id) {
            ToastService.warning('Find The Account First', 'Look up the member before opening a request.');
            return;
        }
        if (rec.found.open_case) {
            ToastService.warning('Request Already Open', 'This account already has an open recovery request.');
            return;
        }
        var email = (rec.form.new_email || '').trim().toLowerCase();
        if (!EMAIL_RE.test(email)) {
            ToastService.highlightField('field-aer-new-email');
            ToastService.warning('New Email Required', "That doesn't look like an email address.");
            return;
        }
        if (rec.found.email && email === String(rec.found.email).toLowerCase()) {
            ToastService.highlightField('field-aer-new-email');
            ToastService.warning('Same Address', 'The new address must differ from the current sign-in address.');
            return;
        }
        var checks = checkedKeys();
        if (!checks.length) {
            ToastService.highlightField('field-aer-checks');
            ToastService.warning('Verification Required', 'Tick at least one identity check you carried out.');
            return;
        }
        var notes = (rec.form.notes || '').trim();
        if (!notes) {
            ToastService.highlightField('field-aer-notes');
            ToastService.warning('Notes Required', 'Record who you spoke to, when, and what you checked.');
            return;
        }

        var target = rec.found;
        rec.opening = true;
        StepUpService.Run({
            purpose:   'admin_recovery',
            deliverTo: null,
            title:     'Confirm it’s you',
            text:      'Opening an email recovery request for ' + fullName(target) + ' (' + email +
                       '). Verify your password and second factor to continue.'
        }, function (token) {
            return AccountEmailsService.AdminOpenRecovery({
                user_id:             target.id,
                new_email:           email,
                verification_notes:  notes,
                verification_checks: checks,
                step_up_token:       token
            });
        }).then(function (data) {
            rec.opening = false;
            if (handleError(data, 'Could Not Open Request')) { return; }
            ToastService.success('Recovery Request Opened',
                'A confirmation link is on its way to ' + email + '. The old address has been ' +
                'notified and can cancel; the change completes after 24 hours or a second ' +
                'administrator’s approval.');
            rec.form = blankForm();
            loadCases();
            // Re-fetch so the summary shows the new open-case banner
            if (rec.query) { lookup(); }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  3. Requests table
    // ═══════════════════════════════════════════════════════════════

    function loadCases() {
        rec.casesLoading = true;
        AccountEmailsService.AdminListRecovery().then(function (data) {
            rec.casesLoading = false;
            rec.casesLoaded  = true;
            if (handleError(data, 'Could Not Load Requests', true)) { return; }
            rec.open   = angular.isArray(data.open)   ? data.open   : [];
            rec.recent = angular.isArray(data.recent) ? data.recent : [];
            // The looked-up account's open-case banner is a snapshot from the
            // lookup — refresh it too, or it lags the table (e.g. still
            // "Awaiting member" after the claimant has confirmed).
            if (rec.found && rec.query) { lookup(); }
        });
    }

    // Backend statuses: awaiting_claimant | awaiting_hold | completed | cancelled | expired
    // (plan also mentions awaiting_member / awaiting_sms — all tolerated).
    function phase(c) {
        if (!c) { return 'member'; }   // template may evaluate before a case exists
        var s = c.status || '';
        if (s === 'completed') { return 'completed'; }
        if (s === 'cancelled') { return 'cancelled'; }
        if (s === 'expired')   { return 'expired'; }
        if (s === 'awaiting_hold') { return 'hold'; }
        if (s === 'awaiting_sms' || c.next_step === 'sms_code')  { return 'sms'; }
        // awaiting_member / awaiting_claimant: SMS pending once the link is clicked
        // but the SMS code hasn't been entered yet.
        if (isTruthy(c.sms_required) && c.claimant_verified_at && !c.sms_verified_at) { return 'sms'; }
        return 'member';
    }

    function statusLabel(c) {
        switch (phase(c)) {
            case 'completed': return 'Completed';
            case 'cancelled': return 'Cancelled';
            case 'expired':   return 'Expired';
            case 'hold':      return 'Awaiting hold';
            case 'sms':       return 'SMS pending';
            default:          return 'Awaiting member';
        }
    }

    function statusClass(c) {
        switch (phase(c)) {
            case 'completed': return 'aer-chip--success';
            case 'cancelled':
            case 'expired':   return 'aer-chip--muted';
            case 'hold':      return 'aer-chip--info';
            default:          return 'aer-chip--amber';
        }
    }

    // Secondary line under the chip: "completes in 13 h" / "approved by …"
    function statusDetail(c) {
        var p = phase(c);
        if (p === 'hold') {
            var m = parse(c.completes_at || c.hold_until);
            if (!m && c.hold_remaining_seconds === undefined) { return ''; }
            var mins = (c.hold_remaining_seconds !== undefined && c.hold_remaining_seconds !== null)
                ? Math.ceil(parseInt(c.hold_remaining_seconds, 10) / 60)
                : m.diff(moment(), 'minutes');
            if (!m) { m = moment().add(mins, 'minutes'); }
            if (mins <= 0) { return 'completing shortly'; }
            if (mins < 60) { return 'completes in ' + mins + ' min'; }
            var hours = Math.round(mins / 60);
            if (hours < 48) { return 'completes in ' + hours + ' h'; }
            return 'completes ' + m.fromNow();
        }
        if (p === 'member' || p === 'sms') {
            if (c.approved_by || c.approved_at) {
                return 'approved by ' + approverName(c) + ' · completes once the member confirms';
            }
            return 'completes 24 h after the old address was notified, or on a second approval';
        }
        if (p === 'completed') { return c.completed_at ? rec.fmt(c.completed_at) : ''; }
        if (p === 'cancelled') {
            var by = c.cancelled_by ? 'by ' + (c.cancelled_by === 'owner' ? 'the account owner' : c.cancelled_by) : '';
            return [by, c.cancel_reason].filter(Boolean).join(' · ');
        }
        return '';
    }

    function openerId(c) {
        var ob = c && (c.opened_by || c.initiated_by);
        if (ob && typeof ob === 'object') { return parseInt(ob.id, 10) || 0; }
        return parseInt(ob, 10) || 0;
    }

    function isMine(c) {
        return !!rec.myId && openerId(c) === rec.myId;
    }

    function openerName(c) {
        if (c && c.initiated_by_name) { return c.initiated_by_name; }
        var ob = c && (c.opened_by || c.initiated_by);
        if (ob && typeof ob === 'object') { return fullName(ob); }
        return ob ? 'admin #' + ob : '—';
    }
    function approverName(c) {
        if (c && c.approved_by_name) { return c.approved_by_name; }
        return fullName(c && c.approved_by);
    }
    // The member a case is about: backend sends user_name + user_id (no nested user).
    function caseUser(c) {
        if (!c) { return '—'; }
        if (c.user_name) { return c.user_name; }
        if (c.user && typeof c.user === 'object') { return caseUser(c); }
        return c.user_id ? 'user #' + c.user_id : '—';
    }

    // Approve is hidden for the admin who opened the case (backend enforces FOUR_EYES
    // anyway) and once a second admin has already approved.
    function canApprove(c) {
        var p = phase(c);
        if (p === 'completed' || p === 'cancelled' || p === 'expired') { return false; }
        if (c.approved_at || c.approved_by) { return false; }
        return !isMine(c);
    }

    function approve(c) {
        if (!c || rec.busy[c.id] || rec.needs2fa) { return; }
        rec.busy[c.id] = true;
        StepUpService.Run({
            purpose:   'admin_recovery',
            deliverTo: null,
            title:     'Approve recovery request',
            text:      'Approving the email change for ' + caseUser(c) + ' to ' + (c.new_email || '') +
                       '. This skips the 24-hour hold once the member has confirmed. ' +
                       'Verify your password and second factor to continue.'
        }, function (token) {
            return AccountEmailsService.AdminApprove(c.id, token);
        }).then(function (data) {
            delete rec.busy[c.id];
            if (handleError(data, 'Could Not Approve')) { return; }
            ToastService.success('Request Approved',
                'The change completes as soon as ' + caseUser(c) + ' has confirmed the new address.');
            loadCases();
            if (rec.found && String(rec.found.id) === String(c.user_id || (c.user && c.user.id)) && rec.query) { lookup(); }
        });
    }

    function confirmCancel(c) {
        if (!c || rec.busy[c.id] || rec.needs2fa) { return; }
        var draft  = rec.cancelDraft[c.id] || {};
        var reason = (draft.reason || '').trim();
        if (!reason) {
            ToastService.highlightField('field-aer-cancel-' + c.id);
            ToastService.warning('Reason Required', 'Say why this request is being cancelled — it is recorded on the case.');
            return;
        }
        rec.busy[c.id] = true;
        StepUpService.Run({
            purpose:   'admin_recovery',
            deliverTo: null,
            title:     'Cancel recovery request',
            text:      'Cancelling the email change for ' + caseUser(c) + '. Both addresses will be ' +
                       'notified. Verify your password and second factor to continue.'
        }, function (token) {
            return AccountEmailsService.AdminCancel(c.id, token, reason);
        }).then(function (data) {
            delete rec.busy[c.id];
            if (handleError(data, 'Could Not Cancel')) { return; }
            delete rec.cancelDraft[c.id];
            ToastService.success('Request Cancelled', 'The pending address has been removed and both addresses notified.');
            loadCases();
            if (rec.found && String(rec.found.id) === String(c.user_id || (c.user && c.user.id)) && rec.query) { lookup(); }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  4. Security events
    // ═══════════════════════════════════════════════════════════════

    function loadEvents() {
        var id = (rec.eventsUserId || '').toString().trim();
        if (!id) {
            rec.events = [];
            rec.eventsLoaded = false;
            return;
        }
        if (!/^\d+$/.test(id)) {
            ToastService.highlightField('field-aer-events-user');
            ToastService.warning('User ID Required', 'Enter the numeric user ID to filter events.');
            return;
        }
        rec.eventsBusy = true;
        AccountEmailsService.AdminEvents(id).then(function (data) {
            rec.eventsBusy   = false;
            rec.eventsLoaded = true;
            if (handleError(data, 'Could Not Load Events')) {
                rec.events = [];
                return;
            }
            rec.events = (angular.isArray(data.events) ? data.events : []).map(function (e) {
                if (!e.actor && (e.actor_first_name || e.actor_last_name)) {
                    e.actor = { id: e.actor_user_id, first_name: e.actor_first_name, last_name: e.actor_last_name };
                } else if (!e.actor && e.actor_user_id) {
                    e.actor = { id: e.actor_user_id };
                }
                return e;
            });
        });
    }

    // details may arrive as an object or a JSON string; render "key: value" pairs
    function detailsText(e) {
        var d = e && e.details;
        if (!d) { return ''; }
        if (typeof d === 'string') {
            try { d = JSON.parse(d); } catch (err) { return d; }
        }
        if (typeof d !== 'object') { return String(d); }
        var parts = [];
        angular.forEach(d, function (v, k) {
            if (v === null || v === undefined || v === '') { return; }
            parts.push(k + ': ' + (typeof v === 'object' ? JSON.stringify(v) : v));
        });
        return parts.join(' · ');
    }

    // ═══════════════════════════════════════════════════════════════
    //  Shared
    // ═══════════════════════════════════════════════════════════════

    // Services resolve (never reject) with {success:false, error, message}; the
    // generic handleError2 shape nests the body under .message — accept both.
    function errorCode(data) {
        if (!data) { return 'NO_RESPONSE'; }
        if (data.success !== false) { return ''; }
        if (data.error) { return data.error; }
        if (data.message && typeof data.message === 'object') { return data.message.error || ''; }
        return '';
    }

    function errorMessage(data) {
        if (!data) { return ''; }
        if (typeof data.message === 'string') { return data.message; }
        if (data.message && typeof data.message === 'object' && data.message.message) { return data.message.message; }
        return '';
    }

    // Returns true when `data` is an error (and has been reported).
    function handleError(data, title, quiet) {
        if (data && data.success !== false) { return false; }
        var code = errorCode(data);
        var msg  = errorMessage(data);
        switch (code) {
            case 'CANCELLED':            // admin backed out of the step-up modal
                return true;
            case 'ADMIN_2FA_REQUIRED':
                rec.needs2fa = true;
                if (!quiet) {
                    ToastService.warning('Two-Factor Required',
                        'Enable two-factor authentication on your own account to use email recovery.');
                }
                return true;
            case 'FORBIDDEN':
                rec.forbidden = true;
                if (!quiet) { ToastService.error('Not Allowed', 'Your account cannot use email recovery.'); }
                return true;
            case 'FOUR_EYES':
                ToastService.error('Second Administrator Needed', 'A different administrator must approve this request.');
                return true;
            case 'OPEN_CASE_EXISTS':
                ToastService.warning('Request Already Open', 'This account already has an open recovery request.');
                loadCases();
                if (rec.query) { lookup(); }
                return true;
            case 'STEP_UP_REQUIRED':      // retried once inside StepUpService already
                ToastService.error('Verification Expired', 'Your step-up verification lapsed — please try again.');
                return true;
            case 'EMAIL_TAKEN':
            case 'ADDRESS_TAKEN':
                ToastService.error('Address In Use', msg || 'That address is already on another account.');
                return true;
            case 'INVALID_EMAIL':
                ToastService.error('Invalid Address', "That doesn't look like an email address.");
                return true;
            case 'IMPORTED_USER':
                ToastService.error('Imported Account', msg || 'Imported accounts are converted through the Imported Users flow, not email recovery.');
                return true;
            case 'NOT_FOUND':
                ToastService.error(title, msg || 'Not found.');
                return true;
            default:
                ToastService.error(title, msg || 'Please try again.');
                return true;
        }
    }

    function fullName(u) {
        if (!u) { return '—'; }
        if (typeof u !== 'object') { return 'user #' + u; }
        var n = ((u.first_name || '') + ' ' + (u.last_name || '')).trim();
        return n || (u.email ? u.email : (u.id ? 'user #' + u.id : '—'));
    }

    function isTruthy(v) {
        return v === true || v === 1 || v === '1' || v === 'true';
    }

    function parse(s) {
        if (!s) { return null; }
        var m = moment(s);
        return m.isValid() ? m : null;
    }
}
