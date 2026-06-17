app.factory('PlaneService', PlaneService);

    PlaneService.$inject = ['$http', '$location'];
    function PlaneService($http, $location) {

        // console.log("CALLED");
       var service = {};

        service.GetAll = GetAll;
        service.GetAllByClub = GetAllByClub;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
        service.GetOpenIssues = GetOpenIssues;
        service.GetAllIssues = GetAllIssues;
        service.AddDefect = AddDefect;
        service.DeleteDefect = DeleteDefect;
        service.GetAllReceipts = GetAllReceipts;
        service.AddReceipt = AddReceipt;
        service.DeleteReceipt = DeleteReceipt;
        service.DeleteDefect = DeleteDefect;
        service.GetAllSheetReceipts = GetAllSheetReceipts;
        service.GetAllByClubMaintenance = GetAllByClubMaintenance;
        service.GetByIdMaintenance = GetByIdMaintenance;
        service.AddMaintenance = AddMaintenance;
        service.GetByUserMaintenance = GetByUserMaintenance;
        service.GetByIdMaintenance2 = GetByIdMaintenance2;
        service.GetAddAircraft = GetAddAircraft;
        service.GetAircraftJourneyLogs = GetAircraftJourneyLogs;
        service.GetReceiptsApproval = GetReceiptsApproval;
        service.GetCurrencies = GetCurrencies;
        service.CheckReimbursement = CheckReimbursement;
        service.UpdateReceipt = UpdateReceipt;
        service.ApproveReceipt = ApproveReceipt;
        service.RejectReceipt = RejectReceipt;
        service.GetMyJourneyLogs = GetMyJourneyLogs;
        service.GetUserJourneyLogs = GetUserJourneyLogs;
        service.GetReceiptsClub = GetReceiptsClub;
        service.GetReceiptsAircraft = GetReceiptsAircraft;
        service.GetEngineLogs = GetEngineLogs;
        service.GetPropLogs = GetPropLogs;
        service.GetAirframeLogs = GetAirframeLogs;

        // ── Logbook exports (server-generated CSV / Excel / PDF) ──
        // Mirrors PersonalLogbookService.Download: the backend renders the file
        // (UK CAA format for PDF) and streams it; we save the blob client-side
        // so the $http interceptor's auth headers are attached.
        service.DownloadAirframeLog = DownloadAirframeLog;
        service.DownloadEngineLog = DownloadEngineLog;
        service.DownloadPropLog = DownloadPropLog;
        service.DownloadJourneyLog = DownloadJourneyLog;

        service.GetUpdatedCharges = GetUpdatedCharges;

        service.UpdateAircraftBit = UpdateAircraftBit;

        service.ToggleHiddenFromBooking = ToggleHiddenFromBooking;

        service.GetIncompleteClub = GetIncompleteClub;
        // service.GetMaintenanceForUser = GetMaintenanceForUser;

        service.UpdateAircraftLogbooks = UpdateAircraftLogbooks;

        service.HypotheticalFlightSplit = HypotheticalFlightSplit;

        service.GetAllFlightsByClub = GetAllFlightsByClub;

        service.UpdateOrder = UpdateOrder;

        service.GetMaintenanceEvents = GetMaintenanceEvents;
        service.UpdateMaintenanceEvent = UpdateMaintenanceEvent;
       
        return service; 

        function UpdateOrder(planes){
            return $http.post('/api/v1/planes/organise', planes).then(handleSuccess, handleError2);
        }

        function HypotheticalFlightSplit(pls_id, split){
            return $http.post('/api/v1/plane_log_sheets/hypothetical_flight_split/'+pls_id, split).then(handleSuccess, handleError2);
        }

        function GetAllFlightsByClub(club_id, from_date, to_date, aircraft){
            return $http.post('/api/v1/plane_log_sheets/get_all_for_club/' + club_id, {from_date: from_date, to_date: to_date, aircraft: aircraft}).then(handleSuccess, handleError2);
        }
        
        function UpdateAircraftLogbooks(plane_id){
            return $http.get('/api/v1/planes/update_all_logbooks/'+plane_id).then(handleSuccess, handleError2);
        }

        function GetUpdatedCharges(club_id, plane_id, user_id){
            return $http.get('/api/v1/plane_log_sheets/updated_charges/'+club_id+'/'+plane_id+'/'+user_id+'/').then(handleSuccess, handleError2);
        }

        function UpdateAircraftBit(object){
            return $http.post('/api/v1/planes/'+object.plane_id+'/update_aircraft_bit', object).then(handleSuccess, handleError2);
        }

        function ToggleHiddenFromBooking(plane_id, club_id, hidden_from_booking){
            return $http.post('/api/v1/planes/'+plane_id+'/toggle_hidden_from_booking', {
                club_id: club_id,
                hidden_from_booking: hidden_from_booking
            }).then(handleSuccess, handleError2);
        }

        function GetAirframeLogs(plane_id, offset=0, max=5){
            return $http.get('/api/v1/planes/airframe_logbook/'+plane_id+'?offset='+offset+'&max='+max).then(handleSuccess, handleError2);

        }
        function GetPropLogs(id, plane_id, offset=0, max=5){
            return $http.get('/api/v1/planes/'+plane_id+'/propeller_logbook/'+id+'?offset='+offset+'&max='+max).then(handleSuccess, handleError2);

        }
        function GetEngineLogs(id, plane_id, offset=0, max=5){
            return $http.get('/api/v1/planes/'+plane_id+'/engine_logbook/'+id+'?offset='+offset+'&max='+max).then(handleSuccess, handleError2);

        }

        function GetAircraftJourneyLogs(id, offset=0, max=5){
            return $http.get('/api/v1/planes/get_journey_log/'+id+'?offset='+offset+'&max='+max).then(handleSuccess, handleError2);
        }

        function GetMyJourneyLogs(id, offset=0, max=5){
            return $http.get('/api/v1/planes/get_my_journey_log?offset='+offset+'&max='+max).then(handleSuccess, handleError2);
        }

        // ── Logbook export helpers ──────────────────────────────────────────
        // Stream a server-generated export as a blob and save it client-side.
        // format: 'csv' | 'excel' | 'pdf'. The PDF is rendered by the backend in
        // the UK CAA logbook layout (see LOGBOOK_EXPORT_BACKEND_GUIDE.md). Returns
        // { success:true } / { success:false, message } — resolves, never rejects,
        // matching the rest of this service.
        function exportExtension(format){
            if(format === 'excel') return 'xls';
            if(format === 'pdf') return 'pdf';
            return 'csv';
        }

        // Build a ?from=&to= query string from a {from,to} filters object,
        // skipping empty values (same convention as the personal logbook export).
        function exportQs(filters){
            if(!filters) return '';
            var parts = [];
            ['from', 'to'].forEach(function(k){
                if(filters[k]) parts.push(k + '=' + encodeURIComponent(filters[k]));
            });
            return parts.length ? ('?' + parts.join('&')) : '';
        }

        function downloadLogbook(url, filename, format){
            return $http.get(url, { responseType: 'blob' }).then(function(resp){
                var ct = resp.headers('Content-Type') || (
                    format === 'excel' ? 'application/vnd.ms-excel' :
                    format === 'pdf'   ? 'application/pdf' : 'text/csv'
                );
                var blob = new Blob([resp.data], { type: ct });
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = filename + '.' + exportExtension(format);
                document.body.appendChild(a);
                a.click();
                a.remove();
                return { success: true };
            }, function(){
                return { success: false, message: 'Could not generate the export.' };
            });
        }

        function DownloadAirframeLog(plane_id, format, filename, filters){
            var url = '/api/v1/planes/airframe_logbook/'+plane_id+'/export/'+(format||'csv')+exportQs(filters);
            return downloadLogbook(url, filename || 'Airframe_Logbook', format);
        }

        function DownloadEngineLog(plane_id, engine_id, format, filename, filters){
            var url = '/api/v1/planes/'+plane_id+'/engine_logbook/'+engine_id+'/export/'+(format||'csv')+exportQs(filters);
            return downloadLogbook(url, filename || 'Engine_Logbook', format);
        }

        function DownloadPropLog(plane_id, prop_id, format, filename, filters){
            var url = '/api/v1/planes/'+plane_id+'/propeller_logbook/'+prop_id+'/export/'+(format||'csv')+exportQs(filters);
            return downloadLogbook(url, filename || 'Propeller_Logbook', format);
        }

        function DownloadJourneyLog(plane_id, format, filename, filters){
            var url = '/api/v1/planes/get_journey_log/'+plane_id+'/export/'+(format||'csv')+exportQs(filters);
            return downloadLogbook(url, filename || 'Journey_Logbook', format);
        }

        function GetUserJourneyLogs(user_id, club_id, offset=0, max=5){
            return $http.get('/api/v1/planes/get_user_journey_log/'+user_id+'/'+club_id+'?offset='+offset+'&max='+max).then(handleSuccess, handleError2);
        }

        function GetAddAircraft(reg){
            return $http.get('/api/v1/planes/aircraft/'+reg).then(handleSuccess, handleError2);
        }

        function GetAll() {
            return $http.get('/api/v1/planes/').then(handleSuccess, handleError2);
        }

        function GetOpenIssues(plane_id) {
            return $http.get('/api/v1/plane_tech_log_sheets/open_issues/'+plane_id).then(handleSuccess, handleError2);
        }

        function GetAllIssues(plane_id) {
            return $http.get('/api/v1/plane_tech_log_sheets/all_issues/'+plane_id).then(handleSuccess, handleError2);
        }

        function AddDefect(obj){
            return $http.post('/api/v1/plane_tech_log_sheets', obj).then(handleSuccess, handleError2);
        }

        function DeleteDefect(id){
            return $http.delete('/api/v1/plane_tech_log_sheets/' + id).then(handleSuccess, handleError2);
        }


        function GetReceiptsApproval(club_id){
            return $http.get('/api/v1/lubricant_receipts/for_approval/'+club_id).then(handleSuccess, handleError2);

        }

        function GetReceiptsClub(club_id, offset=0, limit=10){
            return $http.get('/api/v1/lubricant_receipts/for_club/'+club_id+'?offset='+offset+'&limit='+limit).then(handleSuccess, handleError2);

        }

        function GetReceiptsAircraft(aircraft_id, offset=0, limit=5){
            return $http.get('/api/v1/lubricant_receipts/for_aircraft/'+aircraft_id+'?offset='+offset+'&limit='+limit).then(handleSuccess, handleError2);
        }

        function GetCurrencies(club_id){
            return $http.get('/api/v1/lubricant_receipts/currencies/'+club_id).then(handleSuccess, handleError2);
        }

        function GetAllReceipts(plane_id) {
            return $http.get('/api/v1/lubricant_receipts/'+plane_id).then(handleSuccess, handleError2);
        }

        function GetAllSheetReceipts(sheet_id){
            return $http.get('/api/v1/lubricant_receipts/sheet/'+sheet_id).then(handleSuccess, handleError2);
        }

        function AddReceipt(obj){
            return $http.post('/api/v1/lubricant_receipts', obj).then(handleSuccess, handleError2);
        }

        function UpdateReceipt(id, obj){
            return $http.put('/api/v1/lubricant_receipts/'+id, obj).then(handleSuccess, handleError2);
        }

        function ApproveReceipt(id, obj){
       
            return $http.post('/api/v1/lubricant_receipts/approve_receipt/'+id, obj).then(handleSuccess, handleError2);

        }

        function RejectReceipt(id, obj){
            return $http.post('/api/v1/lubricant_receipts/reject_receipt/'+id, obj).then(handleSuccess, handleError2);
        }

        function CheckReimbursement(obj){
            return $http.post('/api/v1/lubricant_receipts/check_reimbursement', obj).then(handleSuccess, handleError2);
        }

        function DeleteReceipt(id){
            return $http.delete('/api/v1/lubricant_receipts/' + id).then(handleSuccess, handleError2);
        }
 

        function GetAllByClub(club_id) {
            return $http.get('/api/v1/planes/club/'+club_id).then(handleSuccess, handleError2);
        }

        function GetAllByClubMaintenance(club_id){
            return $http.get('/api/v1/planes/club_maintenance/'+club_id).then(handleSuccess, handleError2);
        }

        // function GetMaintenanceForUser(user_id){
        //     return $http.get('/api/v1/planes/all_issues/'+plane_id).then(handleSuccess, handleError2);
        // }

        function GetByIdMaintenance(plane_id, club_id){
            return $http.get('/api/v1/planes/' + plane_id + '/club_maintenance/' + club_id).then(handleSuccess, handleError2);
        }

        function GetByIdMaintenance2(plane_id, club_id){
            return $http.get('/api/v1/planes/' + plane_id + '/club_maintenance2/' + club_id).then(handleSuccess, handleError2);
        }

        function GetByUserMaintenance(user_id){
            return $http.get('/api/v1/planes/' + user_id + '/user_maintenance').then(handleSuccess, handleError2);
        }

        function GetById(plane_id, club_id) {
            console.log("club_id "+club_id);
            console.log("plane_id "+plane_id);
            return $http.get('/api/v1/planes/' + plane_id + '/club/' + club_id).then(handleSuccess, handleError2);
        }

        function GetByUrl(url){
            return $http.post('/api/v1/planes/get_by_url', url).then(handleSuccess, handleError2);
        }

        function AddMaintenance(plane_id, content){
            return $http.post('/api/v1/planes/'+plane_id+'/maintenance', content).then(handleSuccess, handleError2);
        }

        function GetMaintenanceEvents(plane_id){
            return $http.get('/api/v1/planes/'+plane_id+'/maintenance_events').then(handleSuccess, handleError2);
        }

        function UpdateMaintenanceEvent(event_id, content){
            return $http.put('/api/v1/maintenance_events/'+event_id, content).then(handleSuccess, handleError2);
        }

        function GetIncompleteClub(club_id){
            return $http.get('/api/v1/plane_log_sheets/incomplete_club/'+club_id).then(handleSuccess, handleError2);
        } //incomplete_club

        function Create(club) {
            var url = '/api/v1/planes/';
            return $http.post(url, club).then(handleSuccess, handleError2);
        }

        function Update(plane) {
            return $http.put('/api/v1/planes/' + plane.plane_id, plane).then(handleSuccess, handleError2);
        }

        function Delete(club_plane_id) {
            //this should be a disabled function only available for people working for the software
            return $http.delete('/api/v1/planes/' + club_plane_id).then(handleSuccess, handleError2);
        }



        function handleError2(res) {
            console.log("ERROR", res);

            if(res.status == 401){
                $location.path('/login');
            }    

            return { success: false, message: res.data, status: res.status };
        }
        // private functions

        function handleSuccess(res) {
            return res.data;
        }

        function handleError(error) {
            return function () {
                return { success: false, message: error };
            };
        }
    }