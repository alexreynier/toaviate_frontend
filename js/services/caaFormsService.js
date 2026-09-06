// ─────────────────────────────────────────────────────
// CaaFormsService — digital CAA paperwork API client.
// Contract: FRONTEND_CAA_FORMS_GUIDE.md / BACKEND_CAA_FORMS_GUIDE.md.
// Convention (matches SmsService):
//   - app.factory + $inject
//   - every call .then(handleSuccess, handleError)
//   - errors RESOLVE with { success:false, error?, message, status }
//   - error:'FORBIDDEN' → the user lacks the role: hide/disable the control
//     (this is how the HoT tab is gated per club — see hot_queue).
// The ONLY public endpoints are caa_form_confirm/* (token in the URL,
// exempted from the auth interceptor in app.js unauthEndpoints).
// ─────────────────────────────────────────────────────
app.factory('CaaFormsService', CaaFormsService);

    CaaFormsService.$inject = ['$http', '$location'];
    function CaaFormsService($http, $location) {

        var base = '/api/v1/caa_forms';
        var pub  = '/api/v1/caa_form_confirm';
        var s = {};

        // Build a ?query string from a params object (skips null/empty values).
        function qs(params) {
            if (!params) return '';
            var p = Object.keys(params).filter(function(k){ return params[k] != null && params[k] !== ''; })
                          .map(function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); });
            return p.length ? ('?' + p.join('&')) : '';
        }

        // ── Types / prefill ──
        // course_id (optional) makes certificate prefill course-aware: call
        // once without it for context.courses, again with it for hour fields
        // computed from the course's tagged training-record flights
        // (FRONTEND_COURSE_CERTIFICATE_PREFILL_GUIDE.md).
        // expiry_date (optional, YYYY-MM-DD) manually anchors the reval
        // FCL.740.A windows + checklist when the pilot's profile has no
        // rating expiry (BACKEND_CAA_MANUAL_EXPIRY_GUIDE.md).
        s.GetTypes   = function(){ return $http.get(base + '/types').then(handleSuccess, handleError); };
        s.GetPrefill = function(form_type, user_id, club_id, course_id, expiry_date){ return $http.get(base + '/prefill/' + form_type + '/' + user_id + qs({ club_id: club_id, course_id: course_id, expiry_date: expiry_date })).then(handleSuccess, handleError); };

        // ── Forms lifecycle ──
        s.List   = function(club_id, filters){ var f = angular.extend({ club_id: club_id }, filters || {}); return $http.get(base + qs(f)).then(handleSuccess, handleError); };
        s.Get    = function(id){ return $http.get(base + '/' + id).then(handleSuccess, handleError); };
        s.Create = function(d){ return $http.post(base, d).then(handleSuccess, handleError); };
        s.Update = function(id, form_data){ return $http.put(base + '/' + id, { form_data: form_data }).then(handleSuccess, handleError); };
        s.Submit = function(id, d){ return $http.post(base + '/' + id + '/submit', d || {}).then(handleSuccess, handleError); };
        s.Sign   = function(id, d){ return $http.post(base + '/' + id + '/sign', d).then(handleSuccess, handleError); };
        s.Decline= function(id, d){ return $http.post(base + '/' + id + '/decline', d).then(handleSuccess, handleError); };
        s.Revert = function(id){ return $http.post(base + '/' + id + '/revert', {}).then(handleSuccess, handleError); };
        s.Cancel = function(id){ return $http.delete(base + '/' + id).then(handleSuccess, handleError); };

        // ── External signers ──
        s.SendExternal   = function(id, d){ return $http.post(base + '/' + id + '/send_external', d).then(handleSuccess, handleError); };
        s.ResendExternal = function(id, role){ return $http.post(base + '/' + id + '/resend_external', { role: role }).then(handleSuccess, handleError); };

        // ── Queues (per-club; hot_queue FORBIDDEN → user is not HoT/deputy there) ──
        s.Queue    = function(club_id){ return $http.get(base + '/queue' + qs({ club_id: club_id })).then(handleSuccess, handleError); };
        s.HotQueue = function(club_id){ return $http.get(base + '/hot_queue' + qs({ club_id: club_id })).then(handleSuccess, handleError); };

        // ── Deputies (HoT settings) ──
        s.GetDeputies  = function(club_id){ return $http.get(base + '/deputies' + qs({ club_id: club_id })).then(handleSuccess, handleError); };
        s.AddDeputy    = function(club_id, user_id){ return $http.post(base + '/deputies', { club_id: club_id, user_id: user_id }).then(handleSuccess, handleError); };
        s.RemoveDeputy = function(id){ return $http.delete(base + '/deputies/' + id).then(handleSuccess, handleError); };

        // ── Files (certified true copy; draft only) ──
        s.UploadFile = function(id, file, label){
            var fd = new FormData();
            fd.append('file', file);
            fd.append('document_label', label || '');
            return $http.post(base + '/' + id + '/files', fd, {
                transformRequest: angular.identity,
                headers: { 'Content-Type': undefined }
            }).then(handleSuccess, handleError);
        };
        s.GetFile    = function(id, file_id){ return $http.get(base + '/' + id + '/files/' + file_id).then(handleSuccess, handleError); };
        s.DeleteFile = function(id, file_id){ return $http.delete(base + '/' + id + '/files/' + file_id).then(handleSuccess, handleError); };

        // ── PDF (auth-headed blob; filename in X-Filename). Resolves
        //    { success:true, blob, filename } — caller saves it. ──
        s.GetPdf = function(id, fallbackName){
            return $http.get(base + '/' + id + '/pdf', { responseType: 'blob' })
                .then(function(res){
                    return {
                        success: true,
                        blob: res.data,
                        filename: res.headers('X-Filename') || fallbackName || ('caa_form_' + id + '.pdf')
                    };
                }, handleError);
        };

        // ── Audit trail ──
        s.GetAudit = function(id){ return $http.get(base + '/' + id + '/audit').then(handleSuccess, handleError); };

        // ── Public signing page (NO auth — exempted in app.js unauthEndpoints) ──
        s.PublicGet     = function(token){ return $http.get(pub + '/' + token).then(handleSuccess, handleError); };
        s.PublicSign    = function(token, d){ return $http.post(pub + '/' + token + '/sign', d).then(handleSuccess, handleError); };
        s.PublicDecline = function(token, reason){ return $http.post(pub + '/' + token + '/decline', { reason: reason || '' }).then(handleSuccess, handleError); };

        // ── Reference data ─────────────────────────────────────────────
        // Manoeuvre/section grids. Item ids MUST match the printed numbering
        // of the chosen form (backend whitelist strips anything else).
        // Forms without an entry here don't render a grid.
        s.grids = {
            // SRG1157 proficiency/skill test + stand-alone IR (dotted items).
            srg1157_skill_test: [
                { key: '1',  label: 'Section 1 — Departure',                          items: ['1.1','1.2','1.2.1','1.2.2','1.3','1.4','1.5','1.6','1.7','1.8'] },
                { key: '2',  label: 'Section 2 — Airwork',                            items: ['2.1','2.2','2.3','2.4','2.5'] },
                { key: '3A', label: 'Section 3A — En-route procedures',               items: ['3A.1','3A.2','3A.3','3A.4','3A.5','3A.6'] },
                { key: '3B', label: 'Section 3B — Radio navigation',                  items: ['3B.1','3B.2','3B.3','3B.4','3B.5','3B.6','3B.7','3B.8'] },
                { key: '4',  label: 'Section 4 — Approach & landings',                items: ['4.1','4.2','4.3','4.4','4.5','4.6','4.7','4.8'] },
                { key: '5',  label: 'Section 5 — Abnormal & emergency procedures',    items: ['5.1','5.2','5.3','5.4','5.5','5.6'] },
                { key: '6',  label: 'Section 6 — Class / type specific items',        items: ['6.1','6.2','6.3','6.4'] }
            ],
            // SRG1176 — IMC / IR(R). Note: no 3.3 on the printed form.
            srg1176: [
                { key: '1', label: 'Section 1', items: ['1.1','1.2','1.3','1.4','1.5','1.5.1','1.5.2'] },
                { key: '2', label: 'Section 2', items: ['2.1','2.2','2.3','2.4.1','2.4.2','2.4.3'] },
                { key: '3', label: 'Section 3', items: ['3.1','3.2','3.4'] },
                { key: '4', label: 'Section 4', items: ['4.1','4.2','4.3','4.4'] },
                { key: '5', label: 'Section 5', items: ['5.1','5.2'] },
                { key: '6', label: 'Section 6', items: ['6.1','6.2','6.3'] }
            ]
        };
        s.grids.srg1157_ir = s.grids.srg1157_skill_test;

        // SRG2128 / SRG2130 matrix forms: per-section result ('1'…'6') plus
        // item cells '1a'…'6h'. Cells the printed form doesn't have are simply
        // never sent (blank stays blank; the backend strips unknown ids).
        s.matrix = {
            sections: ['1','2','3','4','5','6'],
            letters:  ['a','b','c','d','e','f','g','h']
        };
        s.isMatrixType = function(t){ return t === 'srg2128' || t === 'srg2130'; };

        s.sectionValues = ['pass','fail','na'];

        // Status → display metadata (single source for chips/timeline).
        s.statuses = {
            draft:               { label: 'Draft',               tone: 'muted'   },
            awaiting_signatures: { label: 'Awaiting signatures', tone: 'info'    },
            awaiting_hot:        { label: 'Awaiting HoT',        tone: 'warning' },
            completed:           { label: 'Completed',           tone: 'success' },
            declined:            { label: 'Declined',            tone: 'danger'  },
            cancelled:           { label: 'Cancelled',           tone: 'muted'   }
        };

        s.roleLabels = {
            applicant: 'Applicant', instructor: 'Instructor',
            examiner: 'Examiner',   hot: 'Head of Training'
        };

        s.categoryLabels = {
            revalidation: 'Revalidation',
            skill_test: 'Skill tests & examiner reports',
            certification: 'Certification',
            certificate: 'Certificates'
        };

        // Static fallback for form-type metadata (titles etc. when a form is
        // opened before/without GET caa_forms/types). The types endpoint stays
        // authoritative for the picker.
        s.typeMeta = {
            srg1157_reval:      { title: 'SRG1157 — SEP/TMG revalidation by experience', category: 'revalidation', family: 'reval' },
            srg1107_reval:      { title: 'SRG1107 — revalidation by experience',         category: 'revalidation', family: 'reval' },
            srg1157_skill_test: { title: 'SRG1157 — skill test / proficiency check',     category: 'skill_test',   family: 'skill_test' },
            srg1157_ir:         { title: 'SRG1157 — stand-alone IR / SPA',               category: 'skill_test',   family: 'skill_test' },
            srg2128:            { title: 'SRG2128 — PPL(A) skill test',                  category: 'skill_test',   family: 'skill_test' },
            srg2130:            { title: 'SRG2130 — CPL(A) skill test',                  category: 'skill_test',   family: 'skill_test' },
            srg2129:            { title: 'SRG2129 — failure report',                     category: 'skill_test',   family: 'skill_test' },
            srg1176:            { title: 'SRG1176 — IMC / IR(R) test report',            category: 'skill_test',   family: 'skill_test' },
            srg2199:            { title: 'SRG2199 — examiner record',                    category: 'skill_test',   family: 'skill_test' },
            certified_true_copy:{ title: 'Certified true copy',                          category: 'certification',family: 'true_copy' },
            caa5016:            { title: 'CAA5016 — LAPL/PPL course completion',         category: 'certificate',  family: 'caa_certificate' },
            caa5017:            { title: 'CAA5017 — Night Rating course completion',     category: 'certificate',  family: 'caa_certificate' },
            caa5019:            { title: 'CAA5019 — IMC / IR(R) course completion',      category: 'certificate',  family: 'caa_certificate' },
            caa5020:            { title: 'CAA5020 — Aerobatic / Banner / Mountain / Flight Test course completion', category: 'certificate', family: 'caa_certificate' },
            course_certificate: { title: 'Course completion certificate (club-branded)', category: 'certificate',  family: 'certificate' }
        };
        s.typeTitle = function(t){ return (s.typeMeta[t] && s.typeMeta[t].title) || (t || '').replace(/_/g, ' '); };
        s.familyOf  = function(t){ return (s.typeMeta[t] && s.typeMeta[t].family) || null; };
        s.isRevalType = function(t){ return s.familyOf(t) === 'reval'; };

        // ── Editor schema (per form family; keys match the backend whitelist).
        // Shared by the draft editor, the read-only view AND the public
        // signing page, so every surface labels values identically.
        var APPLICANT_GROUP = {
            title: 'Applicant', icon: 'fa-user',
            fields: [
                { key: 'forenames',            label: 'Forenames',            type: 'text' },
                { key: 'surname',              label: 'Surname',              type: 'text' },
                { key: 'date_of_birth',        label: 'Date of birth',        type: 'date' },
                { key: 'caa_reference_number', label: 'CAA reference number', type: 'text' },
                { key: 'licence_type',         label: 'Licence type',         type: 'text' },
                { key: 'licence_number',       label: 'Licence number',       type: 'text' }
            ]
        };

        var SCHEMAS = {
            reval: [
                APPLICANT_GROUP,
                { title: 'Revalidation details', icon: 'fa-sync-alt', fields: [
                    { key: 'class_rating',          label: 'Class rating',            type: 'select', options: ['SEP (land)', 'SEP (sea)', 'TMG'] },
                    { key: 'previous_expiry_date',  label: 'Previous expiry date',    type: 'date' },
                    { key: 'new_expiry_date',       label: 'New expiry date',         type: 'date' },
                    { key: 'total_hours_validity',  label: 'Total hours (validity period)', type: 'hours',
                      hint: 'SRG1107 §3.1 first box — total flight time in the 24-month validity period' },
                    { key: 'total_hours_12m',       label: 'Total hours (12 months)', type: 'hours',
                      hint: 'Checklist figure — not printed on SRG1107' },
                    { key: 'pic_hours_12m',         label: 'PIC hours (12 months)',   type: 'hours' },
                    { key: 'training_flight_dates', label: 'Training flight date(s)', type: 'text' },
                    { key: 'licence_endorsed',      label: 'Licence endorsed',        type: 'bool' },
                    { key: 'notes',                 label: 'Notes',                   type: 'textarea', full: true }
                ]}
            ],
            skill_test: [
                APPLICANT_GROUP,
                { title: 'Test details', icon: 'fa-clipboard-check', fields: [
                    { key: 'test_kind',    label: 'Kind of test',   type: 'select',
                      options: ['initial_issue', 'reval_proficiency_check', 'renewal'],
                      optionLabels: { initial_issue: 'Initial issue', reval_proficiency_check: 'Revalidation / proficiency check', renewal: 'Renewal' } },
                    // Type vs Class: the printed Type/Class box ticks off
                    // whichever of these two is filled — use ONE, not both
                    // (stand-alone IR leaves both blank).
                    { key: 'rating_tested', label: 'Type rating tested', type: 'text',
                      hint: 'Type tests only, incl. variants — leave blank for a class test' },
                    { key: 'class_rating',  label: 'Class rating tested', type: 'text',
                      hint: 'Class tests only, e.g. "SEP (land)" / "MEP" / "TMG" — use this OR the type field' },
                    { key: 'test_date',      label: 'Date of test',   type: 'date' },
                    { key: 'location',       label: 'Location',       type: 'text' },
                    { key: 'start_time',     label: 'Start time',     type: 'text', ph: 'HH:MM' },
                    { key: 'finish_time',    label: 'Finish time',    type: 'text', ph: 'HH:MM' },
                    { key: 'total_duration', label: 'Total duration', type: 'text' },
                    { key: 'flight_time',    label: 'Flight time',    type: 'text' }
                ]},
                { title: 'Aircraft / FSTD', icon: 'fa-plane', fields: [
                    { key: 'aircraft_type',         label: 'Aircraft type',         type: 'text' },
                    { key: 'aircraft_registration', label: 'Aircraft registration', type: 'text' },
                    { key: 'fstd_id',               label: 'FSTD ID',               type: 'text' },
                    { key: 'fstd_authority',        label: 'FSTD authority',        type: 'text' }
                ]},
                { title: 'Result', icon: 'fa-poll', fields: [
                    { key: 'result',               label: 'Result',                type: 'select',
                      options: ['pass', 'partial_pass', 'fail'],
                      optionLabels: { pass: 'Pass', partial_pass: 'Partial pass', fail: 'Fail' } },
                    { key: 'previous_expiry_date', label: 'Previous expiry date',  type: 'date' },
                    { key: 'new_expiry_date',      label: 'New expiry date',       type: 'date' },
                    { key: 'licence_endorsed',     label: 'Licence endorsed',      type: 'bool' },
                    { key: 'ir_se',                label: 'IR — single engine',    type: 'bool' },
                    { key: 'ir_me',                label: 'IR — multi engine',     type: 'bool' },
                    { key: 'pbn_tested',           label: 'PBN tested',            type: 'bool' },
                    { key: 'pbn_no_rnp_apch',      label: 'PBN — no RNP APCH',     type: 'bool' },
                    { key: 'notes',                label: 'Notes',                 type: 'textarea', full: true }
                ]}
            ],
            true_copy: [
                APPLICANT_GROUP,
                { title: 'Certification', icon: 'fa-copy', fields: [
                    { key: 'purpose',        label: 'Purpose',        type: 'text' },
                    { key: 'document_notes', label: 'Document notes', type: 'textarea', full: true }
                ]}
            ],
            certificate: [
                APPLICANT_GROUP,
                { title: 'Course', icon: 'fa-graduation-cap', fields: [
                    { key: 'course_kind',  label: 'Course kind',   type: 'select',
                      options: ['night', 'aerobatic', 'ppl', 'cpl', 'custom'],
                      optionLabels: { night: 'Night rating', aerobatic: 'Aerobatic rating', ppl: 'PPL', cpl: 'CPL', custom: 'Custom' } },
                    { key: 'course_title', label: 'Course title',  type: 'text' },
                    { key: 'course_start', label: 'Course start',  type: 'date' },
                    { key: 'course_end',   label: 'Course end',    type: 'date' },
                    { key: 'course_hours', label: 'Course hours',  type: 'hours' },
                    { key: 'ato_dto_ref',  label: 'ATO/DTO reference', type: 'text' },
                    { key: 'remarks',      label: 'Remarks',       type: 'textarea', full: true }
                ]}
            ]
        };

        // SRG2129 carries two extra free-text blocks.
        SCHEMAS.srg2129 = SCHEMAS.skill_test.concat([
            { title: 'Failure details', icon: 'fa-exclamation-triangle', fields: [
                { key: 'failed_items',   label: 'Failed items',   type: 'textarea', full: true },
                { key: 'retest_details', label: 'Retest details', type: 'textarea', full: true }
            ]}
        ]);

        // Official CAA course-completion certificates (CAA5016/5017/5019/5020).
        // Identical field set; only the certificate_for vocabulary differs —
        // it drives the printed selection ticks, so the options are per-form.
        function caaCertificateSchema(forLabel, forOptions, forLabels) {
            return [
                APPLICANT_GROUP,
                { title: 'Course', icon: 'fa-graduation-cap', fields: [
                    { key: 'certificate_for', label: forLabel, type: 'select',
                      options: forOptions, optionLabels: forLabels },
                    { key: 'course_title',  label: 'Course title',      type: 'text' },
                    { key: 'course_start',  label: 'Course start',      type: 'date' },
                    { key: 'course_end',    label: 'Course end',        type: 'date' },
                    { key: 'aircraft_types',label: 'Aircraft type(s)',  type: 'text' },
                    { key: 'ato_dto_name',  label: 'ATO/DTO name',      type: 'text' },
                    { key: 'ato_dto_ref',   label: 'ATO/DTO reference', type: 'text' }
                ]},
                { title: 'Course hours', icon: 'fa-hourglass-half', fields: [
                    { key: 'total_flight_hours', label: 'Total flight hours', type: 'hours' },
                    { key: 'dual_hours',         label: 'Dual hours',         type: 'hours' },
                    { key: 'solo_hours',         label: 'Solo hours',         type: 'hours' },
                    { key: 'instrument_hours',   label: 'Instrument hours',   type: 'hours' },
                    { key: 'theory_hours',       label: 'Theory hours',       type: 'hours' },
                    { key: 'remarks',            label: 'Remarks',            type: 'textarea', full: true }
                ]}
            ];
        }
        SCHEMAS.caa5016 = caaCertificateSchema('Course completed', ['ppl', 'lapl'],
            { ppl: 'PPL', lapl: 'LAPL' });
        SCHEMAS.caa5017 = caaCertificateSchema('Aircraft category', ['aeroplane', 'helicopter', 'balloon', 'airship'],
            { aeroplane: 'Aeroplane', helicopter: 'Helicopter', balloon: 'Balloon', airship: 'Airship' });
        SCHEMAS.caa5019 = caaCertificateSchema('Rating', ['imc', 'irr'],
            { imc: 'IMC rating', irr: 'IR (Restricted)' });
        SCHEMAS.caa5020 = caaCertificateSchema('Rating', ['aerobatic', 'banner_towing', 'mountain', 'flight_test'],
            { aerobatic: 'Aerobatic', banner_towing: 'Banner towing', mountain: 'Mountain', flight_test: 'Flight test' });

        s.schema = function(form_type){
            if (SCHEMAS[form_type]) { return SCHEMAS[form_type]; }   // per-type overrides (srg2129, caa50xx)
            var fam = s.familyOf(form_type);
            return (fam && SCHEMAS[fam]) || [APPLICANT_GROUP];
        };

        // Read-only rows for the view page + public signing page: only the
        // populated fields, formatted for humans.
        s.displayGroups = function(form_type, form_data) {
            var data = form_data || {};
            return s.schema(form_type).map(function(group) {
                var rows = [];
                group.fields.forEach(function(f) {
                    var v = data[f.key];
                    if (v === undefined || v === null || v === '') { return; }
                    rows.push({ label: f.label, value: formatValue(f, v) });
                });
                return { title: group.title, icon: group.icon, rows: rows };
            }).filter(function(g){ return g.rows.length > 0; });
        };

        function formatValue(field, v) {
            if (field.type === 'bool') { return (v && v !== '0') ? 'Yes' : 'No'; }
            if (field.type === 'date' && window.moment && moment(v, 'YYYY-MM-DD', true).isValid()) {
                return moment(v, 'YYYY-MM-DD').format('DD MMM YYYY');
            }
            if (field.type === 'hours') {
                var hm = s.formatHoursHM(v);
                return hm ? (v + ' (' + hm + ')') : v;   // decimal is what prints on the PDF
            }
            if (field.optionLabels && field.optionLabels[v]) { return field.optionLabels[v]; }
            return v;
        }

        // ── Hours entry: accept decimal ("61.5") OR HH:MM-style ("61:30",
        //    "61h 30m", "61h") — everything normalises to DECIMAL hours,
        //    which is what the API schema and the printed PDF use. ──
        s.parseHours = function(v) {
            if (v === null || v === undefined || v === '') { return null; }
            if (typeof v === 'number') { return isNaN(v) ? null : v; }
            var str = String(v).trim().toLowerCase();
            var m = str.match(/^(\d{1,4})\s*[:h]\s*([0-5]?\d)\s*m?$/);   // 61:30 / 61h30 / 61h 30m
            if (m) { return Math.round((parseInt(m[1], 10) + parseInt(m[2], 10) / 60) * 100) / 100; }
            m = str.match(/^(\d{1,4})\s*h$/);                            // "61h"
            if (m) { return parseInt(m[1], 10); }
            if (/^\d+([.,]\d+)?$/.test(str)) { return Math.round(parseFloat(str.replace(',', '.')) * 100) / 100; }
            return null;
        };
        s.formatHoursHM = function(dec) {
            dec = s.parseHours(dec);
            if (dec === null) { return ''; }
            var h = Math.floor(dec);
            var mins = Math.round((dec - h) * 60);
            if (mins === 60) { h++; mins = 0; }
            return h + 'h ' + (mins < 10 ? '0' : '') + mins + 'm';
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
