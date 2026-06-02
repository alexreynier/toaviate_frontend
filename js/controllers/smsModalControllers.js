// ─────────────────────────────────────────────────────
// SMS modal controllers — detail drawer, risk form, action complete,
// bulletin form. All follow the $uibModalInstance pattern: close(data) on
// success so the parent reloads, dismiss('cancel') otherwise.
// ─────────────────────────────────────────────────────

// ── Generic detail modal: hazard / occurrence / audit ──
app.controller('SmsDetailModalController', SmsDetailModalController);
SmsDetailModalController.$inject = ['$uibModalInstance', 'SmsService', 'ToastService', 'clubId', 'kind', 'recordId', 'access', 'enums'];
function SmsDetailModalController($uibModalInstance, SmsService, ToastService, clubId, kind, recordId, access, enums) {
    var m = this;
    m.kind = kind;
    m.access = access;
    m.enums = enums;
    m.loading = true;
    m.record = null;
    m.history = [];
    m.newComment = '';
    m.newStatus = '';
    m._dirty = false;

    m.pretty = function(s) { return s ? String(s).replace(/_/g, ' ') : ''; };
    m.statusBadge = function(status) {
        switch (status) {
            case 'closed': case 'completed': case 'verified': return 'sms-badge--green';
            case 'submitted': case 'open': return 'sms-badge--blue';
            case 'overdue': case 'failed': return 'sms-badge--red';
            case 'in_progress': case 'review': case 'monitoring': case 'investigation': return 'sms-badge--amber';
            default: return 'sms-badge--grey';
        }
    };
    m.severityBadge = function(sev) {
        switch (sev) {
            case 'catastrophic': case 'hazardous': return 'sms-badge--red';
            case 'major': return 'sms-badge--orange';
            case 'minor': return 'sms-badge--amber';
            default: return 'sms-badge--grey';
        }
    };

    load();
    function load() {
        var getter;
        if (kind === 'hazard') getter = SmsService.GetHazard(clubId, recordId);
        else if (kind === 'occurrence') getter = SmsService.GetOccurrence(clubId, recordId);
        else if (kind === 'audit') getter = SmsService.GetAudit(clubId, recordId);
        getter.then(function(data) {
            m.loading = false;
            m.record = (data && data.success === false) ? null : data;
            m.newStatus = m.record ? m.record.status : '';
        });
        if (kind === 'hazard') {
            SmsService.HazardHistory(clubId, recordId).then(function(h) {
                m.history = angular.isArray(h) ? h : (h.items || []);
            });
        }
    }

    m.statusOptions = function() {
        if (kind === 'hazard') return enums.hazardStatus;
        if (kind === 'occurrence') return ['submitted', 'review', 'investigation', 'closed'];
        if (kind === 'audit') return ['planned', 'in_progress', 'completed', 'closed'];
        return [];
    };

    m.saveStatus = function() {
        if (!m.newStatus || m.newStatus === m.record.status) return;
        var call;
        if (kind === 'hazard') call = SmsService.HazardStatus(clubId, recordId, m.newStatus);
        else if (kind === 'occurrence') call = SmsService.OccurrenceStatus(clubId, recordId, m.newStatus);
        else if (kind === 'audit') call = SmsService.AuditStatus(clubId, recordId, m.newStatus);
        call.then(function(data) {
            if (data && data.success) {
                m.record.status = m.newStatus;
                m._dirty = true;
                ToastService.success('Status updated', m.pretty(m.newStatus));
            } else if (data && data.error === 'FORBIDDEN') {
                ToastService.error('Not allowed', 'You do not have permission to change this.');
            } else {
                ToastService.error('Could not update', (data && data.message) || '');
            }
        });
    };

    m.addComment = function() {
        if (!m.newComment || m.newComment.trim().length < 2) return;
        SmsService.HazardComment(clubId, recordId, m.newComment).then(function(data) {
            if (data && data.success) {
                ToastService.success('Comment added', '');
                m.newComment = '';
                m._dirty = true;
                load();
            } else {
                ToastService.error('Could not add comment', (data && data.message) || '');
            }
        });
    };

    m.close = function() { $uibModalInstance.close(m._dirty); };
    m.cancel = function() { if (m._dirty) $uibModalInstance.close(true); else $uibModalInstance.dismiss('cancel'); };
}


// ── Risk create/edit modal with 5×5 matrix pickers ──
app.controller('SmsRiskModalController', SmsRiskModalController);
SmsRiskModalController.$inject = ['$uibModalInstance', 'SmsService', 'ToastService', 'clubId', 'risk', 'enums'];
function SmsRiskModalController($uibModalInstance, SmsService, ToastService, clubId, risk, enums) {
    var m = this;
    m.isEdit = !!risk;
    m.scale = [1, 2, 3, 4, 5];
    m.risk = risk || {
        title: '', hazard_source: '', existing_controls: '', proposed_mitigations: '',
        likelihood: null, severity: null,
        residual_likelihood: null, residual_severity: null,
        owner: '', review_date: null, status: 'open'
    };

    // Colour a 5×5 cell by likelihood×severity score (mirrors typical CAA matrix).
    m.cellColour = function(l, sv) {
        var score = l * sv;
        if (score >= 15) return '#fecaca';      // extreme/high — red
        if (score >= 8)  return '#fed7aa';       // high — orange
        if (score >= 4)  return '#fef08a';       // medium — yellow
        return '#bbf7d0';                        // low — green
    };
    m.pick = function(which, l, sv) {
        if (which === 'initial') { m.risk.likelihood = l; m.risk.severity = sv; }
        else { m.risk.residual_likelihood = l; m.risk.residual_severity = sv; }
    };
    m.isSel = function(which, l, sv) {
        if (which === 'initial') return m.risk.likelihood === l && m.risk.severity === sv;
        return m.risk.residual_likelihood === l && m.risk.residual_severity === sv;
    };

    m.save = function() {
        if (!m.risk.title || m.risk.title.trim().length < 3) { ToastService.warning('Add a title', 'Name the risk.'); return; }
        if (!m.risk.likelihood || !m.risk.severity) { ToastService.warning('Score the risk', 'Tap a cell in the initial matrix.'); return; }
        m.saving = true;
        var call = m.isEdit ? SmsService.UpdateRisk(clubId, m.risk.id, m.risk) : SmsService.CreateRisk(clubId, m.risk);
        call.then(function(data) {
            m.saving = false;
            if (data && data.success) {
                ToastService.success(m.isEdit ? 'Risk updated' : 'Risk created', data.reference || '');
                $uibModalInstance.close(data);
            } else if (data && data.error === 'FORBIDDEN') {
                ToastService.error('Not allowed', 'You do not have permission.');
            } else {
                ToastService.error('Could not save', (data && data.message) || '');
            }
        });
    };
    m.cancel = function() { $uibModalInstance.dismiss('cancel'); };
}


// ── Complete-action modal (captures completion evidence) ──
app.controller('SmsActionModalController', SmsActionModalController);
SmsActionModalController.$inject = ['$uibModalInstance', 'SmsService', 'ToastService', 'clubId', 'action'];
function SmsActionModalController($uibModalInstance, SmsService, ToastService, clubId, action) {
    var m = this;
    m.action = action;
    m.evidence = '';
    m.save = function() {
        if (!m.evidence || m.evidence.trim().length < 3) { ToastService.warning('Add evidence', 'Briefly note what was done.'); return; }
        m.saving = true;
        SmsService.CompleteAction(clubId, action.id, { completion_evidence: m.evidence }).then(function(data) {
            m.saving = false;
            if (data && data.success) { ToastService.success('Action completed', ''); $uibModalInstance.close(data); }
            else if (data && data.error === 'FORBIDDEN') { ToastService.error('Not allowed', 'You cannot complete this action.'); }
            else { ToastService.error('Could not complete', (data && data.message) || ''); }
        });
    };
    m.cancel = function() { $uibModalInstance.dismiss('cancel'); };
}


// ── Audit create modal ──
app.controller('SmsAuditModalController', SmsAuditModalController);
SmsAuditModalController.$inject = ['$uibModalInstance', 'SmsService', 'ToastService', 'clubId'];
function SmsAuditModalController($uibModalInstance, SmsService, ToastService, clubId) {
    var m = this;
    m.audit = { title: '', audit_type: 'internal', scope: '', scheduled_date: null, status: 'planned' };
    m.save = function() {
        if (!m.audit.title || m.audit.title.trim().length < 3) { ToastService.warning('Add a title', 'Name the audit.'); return; }
        m.saving = true;
        SmsService.CreateAudit(clubId, m.audit).then(function(data) {
            m.saving = false;
            if (data && data.success) { ToastService.success('Audit created', data.reference || ''); $uibModalInstance.close(data); }
            else if (data && data.error === 'FORBIDDEN') { ToastService.error('Not allowed', 'You cannot create audits.'); }
            else { ToastService.error('Could not save', (data && data.message) || ''); }
        });
    };
    m.cancel = function() { $uibModalInstance.dismiss('cancel'); };
}


// ── Bulletin author modal ──
app.controller('SmsBulletinModalController', SmsBulletinModalController);
SmsBulletinModalController.$inject = ['$uibModalInstance', 'SmsService', 'ToastService', 'clubId', 'enums'];
function SmsBulletinModalController($uibModalInstance, SmsService, ToastService, clubId, enums) {
    var m = this;
    m.enums = enums;
    m.bulletin = { bulletin_type: 'safety_bulletin', title: '', body: '', requires_ack: 0, publish_now: 0 };
    m.pretty = function(s) { return s ? String(s).replace(/_/g, ' ') : ''; };
    m.save = function() {
        if (!m.bulletin.title || m.bulletin.title.trim().length < 3) { ToastService.warning('Add a title', ''); return; }
        if (!m.bulletin.body || m.bulletin.body.trim().length < 5) { ToastService.warning('Add some content', ''); return; }
        m.saving = true;
        SmsService.CreateBulletin(clubId, m.bulletin).then(function(data) {
            if (!data || !data.success) {
                m.saving = false;
                if (data && data.error === 'FORBIDDEN') ToastService.error('Not allowed', 'You cannot author bulletins.');
                else ToastService.error('Could not save', (data && data.message) || '');
                return;
            }
            if (m.bulletin.publish_now) {
                SmsService.PublishBulletin(clubId, data.id, { requires_ack: m.bulletin.requires_ack }).then(function(pub) {
                    m.saving = false;
                    ToastService.success('Published', 'Bulletin is live for members.');
                    $uibModalInstance.close(pub);
                });
            } else {
                m.saving = false;
                ToastService.success('Draft saved', 'Publish it when ready.');
                $uibModalInstance.close(data);
            }
        });
    };
    m.cancel = function() { $uibModalInstance.dismiss('cancel'); };
}
