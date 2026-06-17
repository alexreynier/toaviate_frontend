// ─────────────────────────────────────────────────────
// QuestionnaireService — course/lesson questionnaires.
// Authoring (instructor/admin), student attempts, instructor review.
// Role-gating is enforced by the backend per the questionnaire's club_id;
// the UI just shows the right controls. Standard app.factory + handlers.
// ─────────────────────────────────────────────────────
app.factory('QuestionnaireService', QuestionnaireService);

    QuestionnaireService.$inject = ['$http', '$location'];
    function QuestionnaireService($http, $location) {

        var base = '/api/v1/questionnaires';
        var s = {};

        // ── Authoring (instructor / admin) ──
        s.ListByClub   = function(club_id) { return $http.get(base + '/club/' + club_id).then(ok, err); };
        s.Get          = function(id) { return $http.get(base + '/' + id).then(ok, err); };           // full def WITH key
        s.GetForTarget = function(type, id, timing) {
            return $http.get(base + '/target/' + type + '/' + id + (timing ? ('?timing=' + timing) : '')).then(ok, err);
        };
        s.Create       = function(data) { return $http.post(base, data).then(ok, err); };
        s.Update       = function(id, data) { return $http.put(base + '/' + id, data).then(ok, err); };
        s.Delete       = function(id) { return $http.delete(base + '/' + id).then(ok, err); };
        s.AddQuestion    = function(id, q) { return $http.post(base + '/' + id + '/questions', q).then(ok, err); };
        s.UpdateQuestion = function(qid, q) { return $http.put(base + '/question/' + qid, q).then(ok, err); };
        s.DeleteQuestion = function(qid) { return $http.delete(base + '/question/' + qid).then(ok, err); };
        s.SetOptions     = function(qid, options) { return $http.post(base + '/question/' + qid + '/options', { options: options }).then(ok, err); };
        s.AddLink    = function(id, attach_type, attach_id, timing) { return $http.post(base + '/' + id + '/links', { attach_type: attach_type, attach_id: attach_id, timing: timing || 'pre' }).then(ok, err); };
        s.RemoveLink = function(linkId) { return $http.delete(base + '/link/' + linkId).then(ok, err); };

        // ── Student ──
        s.Mine        = function() { return $http.get(base + '/mine').then(ok, err); };
        s.GetAttempt  = function(id) { return $http.get(base + '/attempt/' + id).then(ok, err); };    // own attempt (key/score gated)
        s.Open        = function(id, ctx) { return $http.post(base + '/' + id + '/open', ctx || {}).then(ok, err); };   // ctx may include {attach_type, attach_id, timing}
        s.SaveAttempt = function(attemptId, body) { return $http.post(base + '/attempt/' + attemptId + '/save', body).then(ok, err); };
        s.Submit      = function(attemptId, body) { return $http.post(base + '/attempt/' + attemptId + '/submit', body).then(ok, err); };

        // ── Instructor review ──
        s.AttemptsFor    = function(id) { return $http.get(base + '/' + id + '/attempts').then(ok, err); };
        s.StudentAttempts = function(club_id, student_id) { return $http.get(base + '/student/' + club_id + '/' + student_id).then(ok, err); };
        s.StudentAttemptsForTarget = function(club_id, student_id, type, attach_id, timing) {
            return $http.get(base + '/student/' + club_id + '/' + student_id + '/' + type + '/' + attach_id + (timing ? ('?timing=' + timing) : '')).then(ok, err);
        };
        s.Review      = function(attemptId) { return $http.get(base + '/review/' + attemptId).then(ok, err); };   // full WITH key + marking
        s.SaveReview  = function(attemptId, body) { return $http.post(base + '/attempt/' + attemptId + '/review', body).then(ok, err); };
        s.MarkAnswer  = function(answerId, body) { return $http.post(base + '/answer/' + answerId + '/mark', body).then(ok, err); };

        return s;

        function ok(r) { return r.data; }
        function err(r) {
            if (r && r.status == 401) { $location.path('/login'); }
            var d = r && r.data;
            return { success: false, code: d ? d.code : (r ? r.status : 0), message: d ? (d.message || d.error) : 'Request failed' };
        }
    }
