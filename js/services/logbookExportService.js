// ─────────────────────────────────────────────────────
// LogbookExportService — shared export-panel behaviour for the maintenance
// logbooks (airframe / engine / propeller) and the aircraft journey log.
//
// A controller calls LogbookExportService.attach(vm, { baseName, download })
// and gets a complete, self-contained export panel wired onto its vm:
//   • vm.exportPanelOpen / toggleExportPanel / closeExportPanel
//   • vm.exportFilters { from, to }  (Date objects from input[type=date])
//   • vm.exportPreset / setExportPreset(key)  — quick ranges
//   • vm.exporting  (busy flag)
//   • vm.runExport(format)  — 'csv' | 'excel' | 'pdf'
//   • vm.clearExportRange()
//
// The `download` callback receives (format, filename, filters) where filters is
// { from:'YYYY-MM-DD', to:'YYYY-MM-DD' } (only the set keys) and must return the
// PlaneService.Download* promise. Keeps every logbook page identical, DRY and
// consistent with the snazzy design.
// ─────────────────────────────────────────────────────
app.factory('LogbookExportService', LogbookExportService);

    LogbookExportService.$inject = ['ToastService'];
    function LogbookExportService(ToastService) {

        var service = { attach: attach };
        return service;

        // YYYY-MM-DD from a Date (local calendar values — no UTC drift), or '' .
        function toYMD(d) {
            if (!d) return '';
            if (typeof d === 'string') return d.slice(0, 10);
            var y = d.getFullYear(),
                m = ('0' + (d.getMonth() + 1)).slice(-2),
                dd = ('0' + d.getDate()).slice(-2);
            return y + '-' + m + '-' + dd;
        }

        function attach(vm, opts) {
            opts = opts || {};
            var labels = { csv: 'CSV', excel: 'Excel', pdf: 'PDF' };

            vm.exporting = false;
            vm.exportPanelOpen = false;
            vm.exportFilters = { from: null, to: null };
            vm.exportPreset = 'all';   // 'all' | '30d' | '90d' | 'year' | 'custom'

            vm.toggleExportPanel = function () {
                vm.exportPanelOpen = !vm.exportPanelOpen;
            };
            vm.closeExportPanel = function () {
                vm.exportPanelOpen = false;
            };

            // Quick presets compute From/To relative to today. 'all' clears the
            // range (full export). Selecting custom dates flips the chip to
            // 'custom' via onExportDateChange().
            vm.setExportPreset = function (key) {
                vm.exportPreset = key;
                var to = new Date();
                var from = new Date();
                if (key === 'all') {
                    vm.exportFilters = { from: null, to: null };
                    return;
                }
                if (key === '30d') {
                    from.setDate(from.getDate() - 30);
                } else if (key === '90d') {
                    from.setDate(from.getDate() - 90);
                } else if (key === 'year') {
                    from = new Date(to.getFullYear(), 0, 1);
                }
                vm.exportFilters = { from: from, to: to };
            };

            // Called from the date inputs' ng-change so manual edits show as 'custom'.
            vm.onExportDateChange = function () {
                vm.exportPreset = 'custom';
            };

            vm.clearExportRange = function () {
                vm.setExportPreset('all');
            };

            vm.exportRangeLabel = function () {
                var f = toYMD(vm.exportFilters.from);
                var t = toYMD(vm.exportFilters.to);
                if (!f && !t) return 'All time';
                if (f && t) return f + ' → ' + t;
                if (f) return 'From ' + f;
                return 'Up to ' + t;
            };

            vm.runExport = function (format) {
                if (vm.exporting) return;
                if (typeof opts.download !== 'function') return;

                // Build the filters payload — only include set, valid dates.
                var filters = {};
                var f = toYMD(vm.exportFilters.from);
                var t = toYMD(vm.exportFilters.to);
                if (f) filters.from = f;
                if (t) filters.to = t;

                // Guard: from must not be after to.
                if (filters.from && filters.to && filters.from > filters.to) {
                    ToastService.warning('Check the dates', 'The "From" date is after the "To" date.');
                    return;
                }

                var filename = (typeof opts.baseName === 'function') ? opts.baseName() : (opts.baseName || 'Logbook');

                vm.exporting = true;
                opts.download(format, filename, filters).then(function (res) {
                    vm.exporting = false;
                    if (res && res.success) {
                        ToastService.success('Export ready', (labels[format] || 'Your file') + ' is downloading.');
                        vm.exportPanelOpen = false;
                    } else {
                        ToastService.error('Export failed', (res && res.message) || 'Please try again.');
                    }
                });
            };
        }
    }
