// TrackerCommerceService — data layer for the tracker ordering / billing /
// returns / maintenance-access module (see FRONTEND_TRACKER_COMMERCE_GUIDE.md).
//
// Conventions (same as smsService):
//  - app.factory + $inject, every call .then(handleSuccess, handleError)
//  - success responses come back as the raw body ({ success:true, ... });
//    errors RESOLVE (never reject) with { success:false, message, status }
//  - the apiUrlInterceptor in app.js prefixes '/api/v1/...' automatically
app.factory('TrackerCommerceService', TrackerCommerceService);
    TrackerCommerceService.$inject = ['$http', '$location'];
    function TrackerCommerceService($http, $location) {
        var base = '/api/v1';
        var s = {};

        function qs(params) {
            if (!params) { return ''; }
            var parts = [];
            for (var k in params) {
                if (params.hasOwnProperty(k) && params[k] !== null && params[k] !== undefined && params[k] !== '') {
                    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
                }
            }
            return parts.length ? ('?' + parts.join('&')) : '';
        }

        // ── Catalogue & versions (A1 / B2) ────────────────────────────────
        s.GetCatalogue     = function(club_id)     { return $http.get(base + '/tracker_versions/catalogue/' + club_id).then(handleSuccess, handleError); };
        s.ListVersions     = function()            { return $http.get(base + '/tracker_versions/list').then(handleSuccess, handleError); };
        s.GetVersion       = function(id)          { return $http.get(base + '/tracker_versions/detail/' + id).then(handleSuccess, handleError); };
        s.CreateVersion    = function(version)     { return $http.post(base + '/tracker_versions/create', version).then(handleSuccess, handleError); };
        s.EditVersion      = function(id, version) { return $http.put(base + '/tracker_versions/edit/' + id, version).then(handleSuccess, handleError); };
        s.DeleteVersion    = function(id)          { return $http.delete(base + '/tracker_versions/delete/' + id).then(handleSuccess, handleError); };
        s.GetPricing       = function(version_id)  { return $http.get(base + '/tracker_versions/pricing/' + version_id).then(handleSuccess, handleError); };
        s.AddPricing       = function(pricing)     { return $http.post(base + '/tracker_versions/pricing', pricing).then(handleSuccess, handleError); };
        s.EditPricing      = function(id, pricing) { return $http.put(base + '/tracker_versions/pricing/' + id, pricing).then(handleSuccess, handleError); };
        s.DeletePricing    = function(id)          { return $http.delete(base + '/tracker_versions/pricing/' + id).then(handleSuccess, handleError); };
        s.SetVersionFittingPdf = function(id, file){ return $http.post(base + '/tracker_versions/fitting_pdf/' + id, { file: file }).then(handleSuccess, handleError); };

        // ── Orders (A1 / A2 / B3) ─────────────────────────────────────────
        s.QuoteOrder       = function(payload)     { return $http.post(base + '/tracker_orders/quote', payload).then(handleSuccess, handleError); };
        s.PlaceOrder       = function(payload)     { return $http.post(base + '/tracker_orders/place', payload).then(handleSuccess, handleError); };
        s.ListClubOrders   = function(club_id)     { return $http.get(base + '/tracker_orders/club/' + club_id).then(handleSuccess, handleError); };
        s.GetOrder         = function(id)          { return $http.get(base + '/tracker_orders/detail/' + id).then(handleSuccess, handleError); };
        s.ConfirmDelivery  = function(id)          { return $http.put(base + '/tracker_orders/confirm_delivery/' + id, {}).then(handleSuccess, handleError); };
        s.CancelOrder      = function(id, reason)  { return $http.put(base + '/tracker_orders/cancel/' + id, { reason: reason || null }).then(handleSuccess, handleError); };
        s.AdminListOrders  = function(filters)     { return $http.get(base + '/tracker_orders/admin/list' + qs(filters)).then(handleSuccess, handleError); };
        s.MarkOrderPaid    = function(id, reference){ return $http.put(base + '/tracker_orders/mark_paid/' + id, { reference: reference || null }).then(handleSuccess, handleError); };
        s.SetOrderStatus   = function(id, payload) { return $http.put(base + '/tracker_orders/status/' + id, payload).then(handleSuccess, handleError); };
        s.AllocateUnits    = function(id, allocations){ return $http.post(base + '/tracker_orders/allocate/' + id, { allocations: allocations }).then(handleSuccess, handleError); };

        // ── Billing (A3 / B1 / B5) ────────────────────────────────────────
        s.GetBillingProfile    = function(club_id)          { return $http.get(base + '/tracker_billing/profile/' + club_id).then(handleSuccess, handleError); };
        s.UpdateBillingProfile = function(club_id, payload) { return $http.put(base + '/tracker_billing/profile/' + club_id, payload).then(handleSuccess, handleError); };
        s.CardSetup            = function(club_id)          { return $http.post(base + '/tracker_billing/card_setup/' + club_id, {}).then(handleSuccess, handleError); };
        s.CardConfirm          = function(club_id, setup_intent_id) { return $http.post(base + '/tracker_billing/card_confirm/' + club_id, { setup_intent_id: setup_intent_id }).then(handleSuccess, handleError); };
        s.RemoveCard           = function(club_id)          { return $http.delete(base + '/tracker_billing/card/' + club_id).then(handleSuccess, handleError); };
        s.DdSetup              = function(club_id, success_redirect_url) { return $http.post(base + '/tracker_billing/dd_setup/' + club_id, { success_redirect_url: success_redirect_url || null }).then(handleSuccess, handleError); };
        s.DdConfirm            = function(club_id, redirect_flow_id)     { return $http.post(base + '/tracker_billing/dd_confirm/' + club_id, { redirect_flow_id: redirect_flow_id }).then(handleSuccess, handleError); };
        s.RemoveDd             = function(club_id)          { return $http.delete(base + '/tracker_billing/dd/' + club_id).then(handleSuccess, handleError); };
        s.ListClubInvoices     = function(club_id)          { return $http.get(base + '/tracker_billing/invoices/' + club_id).then(handleSuccess, handleError); };
        s.GetInvoice           = function(id)               { return $http.get(base + '/tracker_billing/invoice/' + id).then(handleSuccess, handleError); };
        s.PayInvoice           = function(invoice_id, method) { return $http.post(base + '/tracker_billing/pay/' + invoice_id, method ? { method: method } : {}).then(handleSuccess, handleError); };
        s.AdminOverview        = function()                 { return $http.get(base + '/tracker_billing/admin/overview').then(handleSuccess, handleError); };
        s.AdminListInvoices    = function(filters)          { return $http.get(base + '/tracker_billing/admin/invoices' + qs(filters)).then(handleSuccess, handleError); };
        s.SetInvoiceStatus     = function(id, payload)      { return $http.put(base + '/tracker_billing/invoice_status/' + id, payload).then(handleSuccess, handleError); };

        // ── Units (A4 / B4) ───────────────────────────────────────────────
        s.ListClubUnits    = function(club_id)     { return $http.get(base + '/tracker_units/club/' + club_id).then(handleSuccess, handleError); };
        s.GetUnit          = function(id)          { return $http.get(base + '/tracker_units/detail/' + id).then(handleSuccess, handleError); };
        s.AdminListUnits   = function(filters)     { return $http.get(base + '/tracker_units/admin/list' + qs(filters)).then(handleSuccess, handleError); };
        s.EditUnit         = function(id, payload) { return $http.put(base + '/tracker_units/edit/' + id, payload).then(handleSuccess, handleError); };
        s.PauseBilling     = function(id)          { return $http.put(base + '/tracker_units/pause_billing/' + id, {}).then(handleSuccess, handleError); };
        s.ResumeBilling    = function(id)          { return $http.put(base + '/tracker_units/resume_billing/' + id, {}).then(handleSuccess, handleError); };
        s.RetireUnit       = function(id)          { return $http.put(base + '/tracker_units/retire/' + id, {}).then(handleSuccess, handleError); };

        // ── Returns / RMAs (A5 / B6) ──────────────────────────────────────
        s.ReportReturn     = function(payload)     { return $http.post(base + '/tracker_returns/report', payload).then(handleSuccess, handleError); };
        s.ListClubReturns  = function(club_id)     { return $http.get(base + '/tracker_returns/club/' + club_id).then(handleSuccess, handleError); };
        s.GetReturn        = function(id)          { return $http.get(base + '/tracker_returns/detail/' + id).then(handleSuccess, handleError); };
        s.ReplyReturn      = function(id, message) { return $http.post(base + '/tracker_returns/update/' + id, { message: message }).then(handleSuccess, handleError); };
        s.WithdrawReturn   = function(id)          { return $http.put(base + '/tracker_returns/cancel/' + id, {}).then(handleSuccess, handleError); };
        s.AdminListReturns = function(filters)     { return $http.get(base + '/tracker_returns/admin/list' + qs(filters)).then(handleSuccess, handleError); };
        s.SetReturnStatus  = function(id, payload) { return $http.put(base + '/tracker_returns/status/' + id, payload).then(handleSuccess, handleError); };
        s.ResolveReturn    = function(id, payload) { return $http.put(base + '/tracker_returns/resolve/' + id, payload).then(handleSuccess, handleError); };

        // ── Maintenance access (A6 / C1 / C2) ─────────────────────────────
        s.AssignMaintenanceOrg   = function(payload)  { return $http.post(base + '/tracker_maintenance_access/assign', payload).then(handleSuccess, handleError); };
        s.UnassignMaintenanceOrg = function(link_id)  { return $http.delete(base + '/tracker_maintenance_access/assign/' + link_id).then(handleSuccess, handleError); };
        s.InviteMaintenanceOrg   = function(payload)  { return $http.post(base + '/tracker_maintenance_access/invite', payload).then(handleSuccess, handleError); };
        s.ListMaintenanceInvites = function(club_id)  { return $http.get(base + '/tracker_maintenance_access/invites/' + club_id).then(handleSuccess, handleError); };
        s.RevokeMaintenanceInvite= function(id)       { return $http.delete(base + '/tracker_maintenance_access/invite/' + id).then(handleSuccess, handleError); };
        s.GetMaintenanceInvite   = function(token)    { return $http.get(base + '/tracker_maintenance_access/invite/' + token).then(handleSuccess, handleError); };  // PUBLIC
        s.AcceptMaintenanceInvite= function(payload)  { return $http.post(base + '/tracker_maintenance_access/invite_accept', payload).then(handleSuccess, handleError); };
        s.GetOrgUnits            = function(org_id)   { return $http.get(base + '/tracker_maintenance_access/org/' + org_id).then(handleSuccess, handleError); };

        // ── Audit (B7 + club activity tab) ────────────────────────────────
        s.AuditRecent  = function(filters)          { return $http.get(base + '/tracker_audit/recent' + qs(filters)).then(handleSuccess, handleError); };
        s.AuditEntity  = function(type, id)         { return $http.get(base + '/tracker_audit/entity/' + type + '/' + id).then(handleSuccess, handleError); };
        s.AuditClub    = function(club_id, page)    { return $http.get(base + '/tracker_audit/club/' + club_id + qs({ page: page })).then(handleSuccess, handleError); };

        // ── PDF downloads (auth headers ride along on $http defaults) ─────
        // Streams the PDF as an arraybuffer and triggers a browser download.
        s.DownloadInvoicePdf = function(invoice_id, fallbackName) {
            return downloadPdf(base + '/tracker_billing/invoice_pdf/' + invoice_id, fallbackName || ('tracker-invoice-' + invoice_id + '.pdf'));
        };
        s.DownloadUnitFittingPdf = function(unit_id, fallbackName) {
            return downloadPdf(base + '/tracker_maintenance_access/fitting_pdf/' + unit_id, fallbackName || 'fitting-instructions.pdf');
        };
        s.DownloadVersionFittingPdf = function(version_id, fallbackName) {
            return downloadPdf(base + '/tracker_versions/fitting_pdf/' + version_id, fallbackName || 'fitting-instructions.pdf');
        };

        function downloadPdf(url, fallbackName) {
            return $http.get(url, { responseType: 'arraybuffer' }).then(function(res) {
                var headers = res.headers();
                var contentType = headers['content-type'] || 'application/pdf';
                // A JSON body here means the API returned an application error, not a PDF
                if (contentType.indexOf('application/json') > -1) {
                    var body = {};
                    try { body = JSON.parse(String.fromCharCode.apply(null, new Uint8Array(res.data))); } catch (e) {}
                    return { success: false, message: body.message || 'No PDF is available.' };
                }
                var filename = headers['x-filename'] || fallbackName;
                var blob = new Blob([res.data], { type: contentType });
                var blobUrl = URL.createObjectURL(blob);
                var link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 250);
                return { success: true };
            }, handleError);
        }

        // ── Shared reference data (dropdowns + badge colour maps) ─────────
        s.enums = {
            orderStatus:    ['pending', 'awaiting_payment', 'paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'],
            invoiceStatus:  ['issued', 'payment_pending', 'paid', 'failed', 'cancelled', 'refunded'],
            invoiceType:    ['order', 'recurring', 'adhoc'],
            unitStatus:     ['pending', 'allocated', 'active', 'billing_paused', 'returned', 'retired'],
            returnStatus:   ['reported', 'acknowledged', 'approved', 'awaiting_shipment', 'in_transit', 'received', 'resolved', 'rejected', 'cancelled'],
            returnType:     ['return', 'malfunction'],
            returnReason:   ['defective', 'no_longer_required', 'damaged', 'other'],
            resolution:     ['billing_stopped', 'replaced', 'repaired', 'refunded', 'no_fault_found', 'other'],
            auditEntityTypes: ['version', 'pricing', 'order', 'unit', 'invoice', 'billing_profile', 'return', 'maintenance_link', 'maintenance_invite']
        };

        // status → trk-badge modifier, shared by every screen so colours stay consistent
        s.badges = {
            order: {
                pending: 'trk-badge--grey', awaiting_payment: 'trk-badge--amber', paid: 'trk-badge--blue',
                processing: 'trk-badge--violet', shipped: 'trk-badge--orange', delivered: 'trk-badge--green',
                completed: 'trk-badge--green', cancelled: 'trk-badge--red'
            },
            invoice: {
                issued: 'trk-badge--blue', payment_pending: 'trk-badge--violet', paid: 'trk-badge--green',
                failed: 'trk-badge--red', cancelled: 'trk-badge--grey', refunded: 'trk-badge--amber'
            },
            unit: {
                pending: 'trk-badge--grey', allocated: 'trk-badge--blue', active: 'trk-badge--green',
                billing_paused: 'trk-badge--amber', returned: 'trk-badge--orange', retired: 'trk-badge--red'
            },
            return: {
                reported: 'trk-badge--amber', acknowledged: 'trk-badge--blue', approved: 'trk-badge--violet',
                awaiting_shipment: 'trk-badge--orange', in_transit: 'trk-badge--orange', received: 'trk-badge--blue',
                resolved: 'trk-badge--green', rejected: 'trk-badge--red', cancelled: 'trk-badge--grey'
            }
        };

        return s;

        function handleSuccess(res) { return res.data; }
        function handleError(res) {
            if (res.status == 401) { $location.path('/login'); }
            var body = res.data || {};
            return {
                success: false,
                error: body.error,
                message: body.message || body,
                status: res.status
            };
        }
    }
