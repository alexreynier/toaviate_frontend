// ═══════════════════════════════════════════════════════════════════
//  LogbookEndorsementsService
//  Instructor/examiner countersignatures ("stamps") on personal-logbook
//  lines — pilot requests + external endorsements, the instructor
//  signing queue, and the PUBLIC email-confirmation page endpoints.
//  Signature images are never in list payloads — fetch ForLine() to
//  render the drawn signature.
//  Backend contract: FRONTEND_LOGBOOK_ENDORSEMENTS_GUIDE.md
// ═══════════════════════════════════════════════════════════════════

app.factory('LogbookEndorsementsService', LogbookEndorsementsService);

LogbookEndorsementsService.$inject = ['$http'];
function LogbookEndorsementsService($http) {
    var base = '/api/v1/logbook_endorsements';
    var pub  = '/api/v1/logbook_endorsement_confirm';
    function ok(r){ return r.data; }
    function err(r){ return (r && r.data) ? r.data : { success: false, message: 'Request failed' }; }
    var s = {};

    // ── Pilot ──
    // All endorsements on my lines (any status). Optional status filter.
    s.ListMine  = function(status){ return $http.get(base + (status ? '?status=' + status : '')).then(ok, err); };
    // Full rows for one line, incl. signature images + line_modified_since_signed.
    // kind: 'club' | 'manual' (same as entry.kind); refId: entry.ref_id.
    s.ForLine   = function(kind, refId){ return $http.get(base + '/line/' + kind + '/' + refId).then(ok, err); };
    // Request an in-app sign-off on a CLUB line from a club instructor.
    s.Request   = function(refId, instructorUserId, note){
        return $http.post(base + '/request', { entity_type: 'club', entity_id: refId,
            instructor_user_id: instructorUserId, note: note }).then(ok, err);
    };
    // Record an external endorsement + trigger the confirmation email.
    // payload: { entity_type:'club'|'manual', entity_id, instructor_name,
    //            instructor_number?, instructor_email, endorsement_text,
    //            signature_image? }   (signature optional — can be added at confirm)
    s.AddExternal = function(payload){ return $http.post(base + '/external', payload).then(ok, err); };
    // Re-send the confirmation email (backend enforces max 5 sends, 10-min gap).
    s.Resend    = function(id){ return $http.post(base + '/' + id + '/resend', {}).then(ok, err); };
    // Withdraw an endorsement (pilot on own line, or the signing instructor).
    s.Revoke    = function(id){ return $http.delete(base + '/' + id).then(ok, err); };

    // ── Instructor ──
    // My pending sign-off queue (each row: pilot_name + line summary).
    s.Queue     = function(){ return $http.get(base + '/queue').then(ok, err); };
    // Sign a queued request. stamp: { instructor_name, instructor_number?,
    //                                 endorsement_text, signature_image }
    s.SignRequest = function(id, stamp){ return $http.post(base + '/' + id + '/sign', stamp).then(ok, err); };
    s.Decline     = function(id, reason){ return $http.post(base + '/' + id + '/decline', { reason: reason }).then(ok, err); };
    // Sign a club flight directly (no prior request).
    // payload = stamp + { entity_type:'club', entity_id, pilot_user_id }
    s.SignDirect  = function(payload){ return $http.post(base + '/sign', payload).then(ok, err); };

    // ── Saved stamp ("my signature") ──
    s.GetMySignature    = function(){ return $http.get(base + '/my_signature').then(ok, err); };
    s.SaveMySignature   = function(image, name, number){
        return $http.post(base + '/my_signature',
            { signature_image: image, instructor_name: name, instructor_number: number }).then(ok, err);
    };
    s.DeleteMySignature = function(){ return $http.delete(base + '/my_signature').then(ok, err); };

    // ── Audit trail (per endorsement — pilot, signer, club instructors) ──
    s.Audit = function(id){ return $http.get(base + '/' + id + '/audit').then(ok, err); };

    // ── Public confirmation page (NO login) ──
    s.PublicGet     = function(token){ return $http.get(pub + '/' + token).then(ok, err); };
    s.PublicConfirm = function(token, extras){ return $http.post(pub + '/' + token + '/confirm', extras || {}).then(ok, err); };
    s.PublicDecline = function(token, reason){ return $http.post(pub + '/' + token + '/decline', { reason: reason }).then(ok, err); };

    // Common endorsement wordings for the text picker (free-text always allowed).
    s.wordings = [
        'Training Flight(s) iaw FCL.740.A(b)(1)(ii)',
        'Proficiency check iaw FCL.625',
        'Skill test iaw FCL.235',
        'Instrument proficiency check iaw FCL.625.IR',
        'Night rating training iaw FCL.810',
        'Differences training completed iaw FCL.710'
    ];

    return s;
}
