// ─────────────────────────────────────────────────────
// SmsService — Safety Management System API client.
// Per-club, role-gated, fully audited backend.
// Convention (matches the rest of the app):
//   - app.factory + $inject
//   - every call .then(handleSuccess, handleError)
//   - lists return a bare array; single records return an object;
//     mutations return { success:true, id, reference? } or
//     { success:false, error?, message }.
//   - error:'FORBIDDEN' → the user lacks the role: hide/disable the control.
// ─────────────────────────────────────────────────────
app.factory('SmsService', SmsService);

    SmsService.$inject = ['$http', '$location'];
    function SmsService($http, $location) {

        var base = '/api/v1';
        var s = {};

        // Build a ?query string from a params object (skips null/empty values).
        function qs(params) {
            if (!params) return '';
            var p = Object.keys(params).filter(function(k){ return params[k] != null && params[k] !== ''; })
                          .map(function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); });
            return p.length ? ('?' + p.join('&')) : '';
        }

        // ── Settings / dashboard / audit view ──
        s.GetSettings   = function(c){ return $http.get(base + '/sms/settings/' + c).then(handleSuccess, handleError); };
        s.SaveSettings  = function(c, d){ return $http.put(base + '/sms/settings/' + c, d).then(handleSuccess, handleError); };
        s.GetDashboard  = function(c){ return $http.get(base + '/sms/dashboard/' + c).then(handleSuccess, handleError); };
        s.GetTrends     = function(c){ return $http.get(base + '/sms/trends/' + c).then(handleSuccess, handleError); };
        s.GetAuditView  = function(c){ return $http.get(base + '/sms/audit_view/' + c).then(handleSuccess, handleError); };

        // ── Hazards ──
        s.ListHazards      = function(c, f){ return $http.get(base + '/sms_hazards/' + c + qs(f)).then(handleSuccess, handleError); };
        s.GetHazard        = function(c, id){ return $http.get(base + '/sms_hazards/' + c + '/' + id).then(handleSuccess, handleError); };
        s.SubmitHazard     = function(c, d){ return $http.post(base + '/sms_hazards/' + c, d).then(handleSuccess, handleError); };
        s.UpdateHazard     = function(c, id, d){ return $http.put(base + '/sms_hazards/' + c + '/' + id, d).then(handleSuccess, handleError); };
        s.HazardStatus     = function(c, id, status){ return $http.put(base + '/sms_hazards/' + c + '/' + id + '/status', { status: status }).then(handleSuccess, handleError); };
        s.HazardComment    = function(c, id, comment){ return $http.post(base + '/sms_hazards/' + c + '/' + id + '/comment', { comment: comment }).then(handleSuccess, handleError); };
        s.HazardMitigation = function(c, id, d){ return $http.post(base + '/sms_hazards/' + c + '/' + id + '/mitigation', d).then(handleSuccess, handleError); };
        s.CloseHazard      = function(c, id, d){ return $http.post(base + '/sms_hazards/' + c + '/' + id + '/close', d).then(handleSuccess, handleError); };
        s.LinkHazardRisk   = function(c, id, risk_id){ return $http.put(base + '/sms_hazards/' + c + '/' + id + '/link_risk', { risk_id: risk_id }).then(handleSuccess, handleError); };
        s.HazardHistory    = function(c, id){ return $http.get(base + '/sms_hazards/' + c + '/' + id + '/history').then(handleSuccess, handleError); };
        s.ArchiveHazard    = function(c, id){ return $http.delete(base + '/sms_hazards/' + c + '/' + id).then(handleSuccess, handleError); };

        // ── Occurrences ──
        s.ListOccurrences  = function(c, f){ return $http.get(base + '/sms_occurrences/' + c + qs(f)).then(handleSuccess, handleError); };
        s.GetOccurrence    = function(c, id){ return $http.get(base + '/sms_occurrences/' + c + '/' + id).then(handleSuccess, handleError); };
        s.ReportOccurrence = function(c, d){ return $http.post(base + '/sms_occurrences/' + c, d).then(handleSuccess, handleError); };
        s.UpdateOccurrence = function(c, id, d){ return $http.put(base + '/sms_occurrences/' + c + '/' + id, d).then(handleSuccess, handleError); };
        s.OccurrenceStatus = function(c, id, status){ return $http.put(base + '/sms_occurrences/' + c + '/' + id + '/status', { status: status }).then(handleSuccess, handleError); };
        s.SaveInvestigation= function(c, id, d){ return $http.post(base + '/sms_occurrences/' + c + '/' + id + '/investigation', d).then(handleSuccess, handleError); };

        // ── Risks ──
        s.ListRisks  = function(c, f){ return $http.get(base + '/sms_risks/' + c + qs(f)).then(handleSuccess, handleError); };
        s.GetRisk    = function(c, id){ return $http.get(base + '/sms_risks/' + c + '/' + id).then(handleSuccess, handleError); };
        s.CreateRisk = function(c, d){ return $http.post(base + '/sms_risks/' + c, d).then(handleSuccess, handleError); };
        s.UpdateRisk = function(c, id, d){ return $http.put(base + '/sms_risks/' + c + '/' + id, d).then(handleSuccess, handleError); };
        s.ArchiveRisk= function(c, id){ return $http.delete(base + '/sms_risks/' + c + '/' + id).then(handleSuccess, handleError); };

        // ── Actions ──
        s.ListActions    = function(c, f){ return $http.get(base + '/sms_actions/' + c + qs(f)).then(handleSuccess, handleError); };
        s.CreateAction   = function(c, d){ return $http.post(base + '/sms_actions/' + c, d).then(handleSuccess, handleError); };
        s.UpdateAction   = function(c, id, d){ return $http.put(base + '/sms_actions/' + c + '/' + id, d).then(handleSuccess, handleError); };
        s.CompleteAction = function(c, id, d){ return $http.post(base + '/sms_actions/' + c + '/' + id + '/complete', d).then(handleSuccess, handleError); };

        // ── Audits / findings / change ──
        s.ListAudits   = function(c, f){ return $http.get(base + '/sms_audits/' + c + qs(f)).then(handleSuccess, handleError); };
        s.GetAudit     = function(c, id){ return $http.get(base + '/sms_audits/' + c + '/' + id).then(handleSuccess, handleError); };
        s.CreateAudit  = function(c, d){ return $http.post(base + '/sms_audits/' + c, d).then(handleSuccess, handleError); };
        s.AuditStatus  = function(c, id, status){ return $http.put(base + '/sms_audits/' + c + '/' + id + '/status', { status: status }).then(handleSuccess, handleError); };
        s.ListFindings = function(c, f){ return $http.get(base + '/sms_findings/' + c + qs(f)).then(handleSuccess, handleError); };
        s.CreateFinding= function(c, d){ return $http.post(base + '/sms_findings/' + c, d).then(handleSuccess, handleError); };
        s.UpdateFinding= function(c, id, d){ return $http.put(base + '/sms_findings/' + c + '/' + id, d).then(handleSuccess, handleError); };
        s.FindingStatus= function(c, id, status){ return $http.put(base + '/sms_findings/' + c + '/' + id + '/status', { status: status }).then(handleSuccess, handleError); };
        s.ListChanges  = function(c, f){ return $http.get(base + '/sms_changes/' + c + qs(f)).then(handleSuccess, handleError); };
        s.CreateChange = function(c, d){ return $http.post(base + '/sms_changes/' + c, d).then(handleSuccess, handleError); };
        s.UpdateChange = function(c, id, d){ return $http.put(base + '/sms_changes/' + c + '/' + id, d).then(handleSuccess, handleError); };
        s.ChangeStatus = function(c, id, status){ return $http.put(base + '/sms_changes/' + c + '/' + id + '/status', { status: status }).then(handleSuccess, handleError); };

        // ── Meetings ──
        s.ListMeetings = function(c, f){ return $http.get(base + '/sms_meetings/' + c + qs(f)).then(handleSuccess, handleError); };
        s.GetMeeting   = function(c, id){ return $http.get(base + '/sms_meetings/' + c + '/' + id).then(handleSuccess, handleError); };
        s.CreateMeeting= function(c, d){ return $http.post(base + '/sms_meetings/' + c, d).then(handleSuccess, handleError); };
        s.UpdateMeeting= function(c, id, d){ return $http.put(base + '/sms_meetings/' + c + '/' + id, d).then(handleSuccess, handleError); };
        s.SetAttendees = function(c, id, attendees){ return $http.post(base + '/sms_meetings/' + c + '/' + id + '/attendees', { attendees: attendees }).then(handleSuccess, handleError); };

        // ── Documents ──
        s.ListDocuments  = function(c, f){ return $http.get(base + '/sms_documents/' + c + qs(f)).then(handleSuccess, handleError); };
        s.GetDocument    = function(c, id){ return $http.get(base + '/sms_documents/' + c + '/' + id).then(handleSuccess, handleError); };
        s.CreateDocument = function(c, d){ return $http.post(base + '/sms_documents/' + c, d).then(handleSuccess, handleError); };
        s.UpdateDocument = function(c, id, d){ return $http.put(base + '/sms_documents/' + c + '/' + id, d).then(handleSuccess, handleError); };
        s.AddVersion     = function(c, id, d){ return $http.post(base + '/sms_documents/' + c + '/' + id + '/version', d).then(handleSuccess, handleError); };
        s.ActivateVersion= function(c, id, vid){ return $http.put(base + '/sms_documents/' + c + '/' + id + '/activate/' + vid, {}).then(handleSuccess, handleError); };

        // ── Instructor oversight ──
        s.ListInstructorRecords  = function(c, f){ return $http.get(base + '/sms_instructors/' + c + '/records' + qs(f)).then(handleSuccess, handleError); };
        s.InstructorAlerts       = function(c){ return $http.get(base + '/sms_instructors/' + c + '/records/alerts').then(handleSuccess, handleError); };
        s.CreateInstructorRecord = function(c, d){ return $http.post(base + '/sms_instructors/' + c + '/records', d).then(handleSuccess, handleError); };
        s.UpdateInstructorRecord = function(c, id, d){ return $http.put(base + '/sms_instructors/' + c + '/records/' + id, d).then(handleSuccess, handleError); };
        s.ListInstructorChecks   = function(c, f){ return $http.get(base + '/sms_instructors/' + c + '/checks' + qs(f)).then(handleSuccess, handleError); };
        s.CreateInstructorCheck  = function(c, d){ return $http.post(base + '/sms_instructors/' + c + '/checks', d).then(handleSuccess, handleError); };

        // ── Students / ERP / bulletins ──
        s.ListStudentRecords  = function(c, f){ return $http.get(base + '/sms_students/' + c + qs(f)).then(handleSuccess, handleError); };
        s.CreateStudentRecord = function(c, d){ return $http.post(base + '/sms_students/' + c, d).then(handleSuccess, handleError); };
        s.ListContacts  = function(c){ return $http.get(base + '/sms_erp/' + c + '/contacts').then(handleSuccess, handleError); };
        s.SaveContact   = function(c, d){ return $http.post(base + '/sms_erp/' + c + '/contacts', d).then(handleSuccess, handleError); };
        s.ListExercises = function(c){ return $http.get(base + '/sms_erp/' + c + '/exercises').then(handleSuccess, handleError); };
        s.SaveExercise  = function(c, d){ return $http.post(base + '/sms_erp/' + c + '/exercises', d).then(handleSuccess, handleError); };
        s.ListBulletins  = function(c, f){ return $http.get(base + '/sms_bulletins/' + c + qs(f)).then(handleSuccess, handleError); };
        s.CreateBulletin = function(c, d){ return $http.post(base + '/sms_bulletins/' + c, d).then(handleSuccess, handleError); };
        s.PublishBulletin= function(c, id, d){ return $http.post(base + '/sms_bulletins/' + c + '/' + id + '/publish', d).then(handleSuccess, handleError); };

        // ── Acknowledgements / attachments ──
        s.PendingAcks  = function(c){ return $http.get(base + '/sms/acknowledgements/' + c + '/pending').then(handleSuccess, handleError); };
        s.AckStatus    = function(c, type, id){ return $http.get(base + '/sms/acknowledgements/' + c + '/status/' + type + '/' + id).then(handleSuccess, handleError); };
        s.RequestAck   = function(c, d){ return $http.post(base + '/sms/acknowledgements/' + c + '/request', d).then(handleSuccess, handleError); };
        s.SignAck      = function(c, d){ return $http.post(base + '/sms/acknowledgements/' + c + '/sign', d).then(handleSuccess, handleError); };
        s.ListAttachments    = function(c, type, id){ return $http.get(base + '/sms/attachments/' + c + '/' + type + '/' + id).then(handleSuccess, handleError); };
        s.AddAttachment      = function(c, d){ return $http.post(base + '/sms/attachments/' + c, d).then(handleSuccess, handleError); };
        s.DownloadAttachment = function(c, attId){ return $http.get(base + '/sms/attachments/' + c + '/file/' + attId).then(handleSuccess, handleError); };

        // ── Reference data (enums for dropdowns) ──
        // Centralised so every SMS screen uses identical labels/values.
        s.enums = {
            hazardCategory: ['Flight Operations','Aerodrome','Aircraft','Maintenance','Human Factors','Fatigue','Weather','Security','IFR Operations','Aerobatics','UPRT','Student Performance','Instructor Performance'],
            hazardStatus: ['submitted','review','risk_assessment','mitigation','monitoring','closed'],
            occurrenceType: ['accident','serious_incident','incident','reportable'],
            occurrenceSeverity: ['negligible','minor','major','hazardous','catastrophic'],
            riskBand: ['low','medium','high','extreme'],
            scale: [1,2,3,4,5],
            findingType: ['level_1','level_2','observation','recommendation'],
            actionStatus: ['open','in_progress','completed','overdue','cancelled'],
            actionPriority: ['low','medium','high','critical'],
            mocType: ['New Aircraft','New Aerodrome','New Instructor','New Course','New Simulator','New Software','New Procedure'],
            documentType: ['Operations Manual','Training Manual','SMS Manual','Compliance Manual','ERP','Course Manual'],
            instructorRecordType: ['Licence','FI Certificate','CRI','IRI','Medical','Rating'],
            instructorCheckType: ['Instructor Check','Line Check','Refresher','Standardisation'],
            bulletinType: ['safety_bulletin','lesson_learned','notice','regulatory_update']
        };

        return s;

        // ── Helpers ──
        function handleSuccess(res) {
            return res.data;
        }

        function handleError(res) {
            if (res && res.status == 401) {
                $location.path('/login');
            }
            var data = res && res.data;
            return {
                success: false,
                error: data ? data.error : null,
                message: data ? (data.message || data.error) : 'Request failed',
                status: res ? res.status : 0
            };
        }
    }
