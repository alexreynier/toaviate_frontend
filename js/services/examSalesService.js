app.factory('ExamSalesService', ExamSalesService);

    ExamSalesService.$inject = ['$http', '$location'];
    function ExamSalesService($http, $location) {

        // Ground-exam sales (the shop "Exams" tab), per-course pricing with
        // per-exam overrides, result entry (manual pass/fail + score), CAA
        // certificate files (encrypted at rest, served as data URIs) and the
        // full exam-record audit trail.
        // Contract: BACKEND_EXAM_SALES_GUIDE.md.

        var service = {};

        // ── Catalog & pricing ──
        service.GetCatalog = GetCatalog;           // courses + exams with effective_price
        service.SavePricing = SavePricing;         // default + VAT + overrides in one call

        // ── Selling ──
        service.Sell = Sell;                       // creates the invoice + purchases
        service.GetPending = GetPending;           // outstanding results, oldest first
        service.GetByClub = GetByClub;             // all purchases (optional status filter)
        service.GetByUser = GetByUser;             // a student's purchases
        service.Get = Get;
        service.EnterResult = EnterResult;         // writes the exam_records row
        service.CancelPurchase = CancelPurchase;   // closes an unfulfilled purchase

        // ── Exam records (results) ──
        service.GetRecord = GetRecord;
        service.UpdateRecord = UpdateRecord;       // audited; optional reason
        service.DeleteRecord = DeleteRecord;       // manager; soft delete, re-opens purchase
        service.GetRecordAudit = GetRecordAudit;   // one record's trail
        service.GetClubAudit = GetClubAudit;       // club-wide trail, paginated

        // ── Certificates ──
        service.UploadFile = UploadFile;           // multipart, PNG/JPG/PDF max 20MB
        service.GetFilesForRecord = GetFilesForRecord;
        service.GetFile = GetFile;                 // decrypted base64 + data_uri
        service.DeleteFile = DeleteFile;           // manager

        service.InvoiceStatusKind = InvoiceStatusKind;

        return service;

        // Collapse an invoice status onto what the exam screens care about:
        // 'paid' | 'requested' (DD in flight) | 'unpaid' | null (not provided —
        // purchase rows carry invoice_status once the backend joins it).
        function InvoiceStatusKind(status) {
            switch (status) {
                case 'confirmed':
                case 'paid_out':
                case 'paid':
                case 'complete':
                case 'completed':
                    return 'paid';
                case 'pending_submission':
                case 'submitted':
                    return 'requested';
                case 'issued':
                case 'created':
                case 'failed':
                case 'charged_back':
                    return 'unpaid';
                default:
                    return null;
            }
        }

        function GetCatalog(club_id, course_id) {
            return $http.get('/api/v1/exam_sales/catalog/' + club_id + (course_id ? '/' + course_id : '')).then(handleSuccess, handleError2);
        }

        // body = { exam_default_price, exam_vat_rate,
        //          overrides: [{exam_id, price|null}] } — null CLEARS an override.
        function SavePricing(course_id, body) {
            return $http.put('/api/v1/exam_sales/pricing/' + course_id, body).then(handleSuccess, handleError2);
        }

        // body = { club_id, course_id, user_id, exam_ids: [..], notes? }
        // → { success, invoice_id, total, vat_rate, purchases: [...] }.
        // Payment is then taken through the normal invoice payment flow.
        function Sell(body) {
            return $http.post('/api/v1/exam_sales', body).then(handleSuccess, handleError2);
        }

        function GetPending(club_id) {
            return $http.get('/api/v1/exam_sales/pending/' + club_id).then(handleSuccess, handleError2);
        }

        // status: 'purchased' | 'result_entered' | 'cancelled' (omit = all, max 500)
        function GetByClub(club_id, status) {
            return $http.get('/api/v1/exam_sales/club/' + club_id + (status ? '/' + status : '')).then(handleSuccess, handleError2);
        }

        function GetByUser(club_id, user_id) {
            return $http.get('/api/v1/exam_sales/user/' + club_id + '/' + user_id).then(handleSuccess, handleError2);
        }

        function Get(id) {
            return $http.get('/api/v1/exam_sales/' + id).then(handleSuccess, handleError2);
        }

        // body = { date, result?, pass_fail (REQUIRED, manual), sitting?, set_no?,
        //          examiner?, notes? } → { success, exam_record_id, item }.
        // Course/exam/student come from the purchase server-side.
        function EnterResult(purchase_id, body) {
            return $http.post('/api/v1/exam_sales/' + purchase_id + '/result', body).then(handleSuccess, handleError2);
        }

        // Cancel ≠ refund — money moves through the normal invoice tools.
        function CancelPurchase(id, reason) {
            return $http.put('/api/v1/exam_sales/' + id + '/cancel', { reason: reason || '' }).then(handleSuccess, handleError2);
        }

        function GetRecord(id) {
            return $http.get('/api/v1/exam_records/' + id).then(handleSuccess, handleError2);
        }

        function UpdateRecord(id, body) {
            return $http.put('/api/v1/exam_records/' + id, body).then(handleSuccess, handleError2);
        }

        function DeleteRecord(id, reason) {
            return $http.delete('/api/v1/exam_records/' + id + (reason ? '?reason=' + encodeURIComponent(reason) : '')).then(handleSuccess, handleError2);
        }

        function GetRecordAudit(exam_record_id) {
            return $http.get('/api/v1/exam_records/audit/' + exam_record_id).then(handleSuccess, handleError2);
        }

        function GetClubAudit(club_id, page, per_page) {
            return $http.get('/api/v1/exam_records/audit/club/' + club_id + '?page=' + (page || 1) + '&per_page=' + (per_page || 50)).then(handleSuccess, handleError2);
        }

        function UploadFile(file, exam_record_id) {
            var fd = new FormData();
            fd.append('file', file);
            fd.append('exam_record_id', exam_record_id);
            return $http.post('/api/v1/exam_record_files', fd, {
                headers: { 'Content-Type': undefined },
                transformRequest: angular.identity,
                timeout: 120000
            }).then(handleSuccess, handleError2);
        }

        function GetFilesForRecord(exam_record_id) {
            return $http.get('/api/v1/exam_record_files/record/' + exam_record_id).then(handleSuccess, handleError2);
        }

        function GetFile(id) {
            return $http.get('/api/v1/exam_record_files/file/' + id).then(handleSuccess, handleError2);
        }

        function DeleteFile(id) {
            return $http.delete('/api/v1/exam_record_files/' + id).then(handleSuccess, handleError2);
        }

        function handleSuccess(res) { return res.data; }

        function handleError2(res) {
            if (res.status == 401) { $location.path('/login'); }
            return { success: false, message: res.data, status: res.status };
        }
    }
