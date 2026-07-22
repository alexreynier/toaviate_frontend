// Modal controllers for the tracker-commerce module. All follow the house
// $uibModal pattern: close(data) on success so the opener reloads,
// dismiss('cancel') otherwise. Templates live in
// views/manageclub/trackers/modals/.

// ── Club: report a problem / request a return (A5) ───────────────────────
app.controller('TrackerReturnReportModalController', TrackerReturnReportModalController);
    TrackerReturnReportModalController.$inject = ['$uibModalInstance', 'TrackerCommerceService', 'ToastService', 'unit'];
    function TrackerReturnReportModalController($uibModalInstance, TrackerCommerceService, ToastService, unit) {
        var m = this;
        m.unit = unit;
        m.form = { type: 'malfunction', reason: 'defective', description: '' };
        m.reasons = TrackerCommerceService.enums.returnReason;
        m.pretty = function(str) { return str ? String(str).replace(/_/g, ' ') : ''; };
        m.saving = false;

        m.submit = function() {
            var ok = ToastService.validateForm([
                { ok: !!m.form.type,   field: 'field-trk-rma-type',   label: 'What kind of report this is' },
                { ok: !!m.form.reason, field: 'field-trk-rma-reason', label: 'A reason' }
            ]);
            if (!ok) { return; }
            m.saving = true;
            TrackerCommerceService.ReportReturn({
                tracker_unit_id: unit.tracker_unit_id || unit.id,
                type: m.form.type,
                reason: m.form.reason,
                description: m.form.description || null
            }).then(function(data) {
                m.saving = false;
                if (data && data.success === false) {
                    ToastService.error('Could not send the report', data.message || 'Please try again.');
                    return;
                }
                ToastService.success('Report sent', 'Your reference is ' + data.rma_number + " — we'll be in touch.");
                $uibModalInstance.close(true);
            });
        };
        m.cancel = function() { $uibModalInstance.dismiss('cancel'); };
    }

// ── Admin: allocate serials to a paid order (B3) ──────────────────────────
app.controller('TrackerAllocateModalController', TrackerAllocateModalController);
    TrackerAllocateModalController.$inject = ['$uibModalInstance', 'TrackerCommerceService', 'FoxTrackerService', 'ToastService', 'order'];
    function TrackerAllocateModalController($uibModalInstance, TrackerCommerceService, FoxTrackerService, ToastService, order) {
        var m = this;
        m.order = order;
        m.saving = false;
        m.trackers = [];

        // One row per unit on the order that has no serial yet
        m.rows = ((order && order.units) || []).filter(function(u) { return !u.serial; }).map(function(u) {
            return {
                tracker_unit_id: u.id || u.tracker_unit_id, version_name: u.version_name,
                serial: '', fox_pick: null,
                register_open: false, new_device: { imei: '', ccid: '', label: '' }, ccid_conflict: null
            };
        });

        // Optional link into the fox_trackers device registry
        FoxTrackerService.GetAll().then(function(data) {
            m.trackers = (data && data.trackers) || [];
        });
        m.trackerLabel = function(t) {
            if (!t) { return ''; }
            return t.imei + (t.label ? (' — ' + t.label) : '');
        };
        // A device can only go on one unit — hide picks made on other rows
        m.availableTrackers = function(row) {
            return m.trackers.filter(function(t) {
                for (var i = 0; i < m.rows.length; i++) {
                    if (m.rows[i] !== row && m.rows[i].fox_pick && m.rows[i].fox_pick.id === t.id) { return false; }
                }
                return true;
            });
        };

        // Register a device that isn't in the registry yet, inline, and select it
        m.toggleRegister = function(row) {
            row.register_open = !row.register_open;
            row.ccid_conflict = null;
        };
        m.registerDevice = function(row, force) {
            var idx = m.rows.indexOf(row);
            var ok = ToastService.validateForm([
                { ok: /^\d{15}$/.test(row.new_device.imei || ''), field: 'field-trk-alloc-imei-' + idx, label: 'A 15-digit IMEI' },
                { ok: !!row.new_device.ccid,                      field: 'field-trk-alloc-ccid-' + idx, label: 'The SIM CCID' }
            ]);
            if (!ok) { return; }
            var payload = {
                imei: row.new_device.imei,
                ccid: row.new_device.ccid,
                label: row.new_device.label || null
            };
            if (force) { payload.allow_ccid_mismatch = true; }
            row.registering = true;
            FoxTrackerService.Create(payload).then(function(data) {
                row.registering = false;
                if (data.success) {
                    var tracker = { id: data.tracker_id, imei: payload.imei, label: payload.label };
                    m.trackers.push(tracker);
                    row.fox_pick = tracker;
                    row.register_open = false;
                    row.ccid_conflict = null;
                    row.new_device = { imei: '', ccid: '', label: '' };
                    ToastService.success('Device registered', tracker.imei + ' is in the registry and linked to this unit.');
                } else if (data.reason === 'ccid_mismatch') {
                    row.ccid_conflict = { message: data.message, transmitted_ccid: data.transmitted_ccid };
                } else {
                    row.ccid_conflict = null;
                    ToastService.error('Could not register the device', data.message || 'Please try again.');
                }
            });
        };
        m.useTransmittedCcid = function(row) {
            if (!row.ccid_conflict) { return; }
            row.new_device.ccid = row.ccid_conflict.transmitted_ccid;
            row.ccid_conflict = null;
            m.registerDevice(row);
        };
        m.forceRegisterAnyway = function(row) {
            row.ccid_conflict = null;
            m.registerDevice(row, true);
        };

        m.submit = function() {
            var checks = m.rows.map(function(r, i) {
                return { ok: !!r.serial, field: 'field-trk-alloc-serial-' + i, label: 'A serial for unit ' + (i + 1) };
            });
            if (!ToastService.validateForm(checks)) { return; }
            var allocations = m.rows.map(function(r) {
                var a = { tracker_unit_id: r.tracker_unit_id, serial: r.serial };
                if (r.fox_pick) { a.fox_tracker_id = r.fox_pick.id; }
                return a;
            });
            m.saving = true;
            TrackerCommerceService.AllocateUnits(order.id, allocations).then(function(data) {
                m.saving = false;
                if (data && data.success === false) {
                    ToastService.error('Could not allocate serials', data.message || 'Please try again.');
                    return;
                }
                ToastService.success('Serials allocated', 'All units on ' + order.order_number + ' now have serials.');
                $uibModalInstance.close(true);
            });
        };
        m.cancel = function() { $uibModalInstance.dismiss('cancel'); };
    }

// ── Admin: ship an order (B3) ─────────────────────────────────────────────
app.controller('TrackerShipModalController', TrackerShipModalController);
    TrackerShipModalController.$inject = ['$uibModalInstance', 'TrackerCommerceService', 'ToastService', 'order'];
    function TrackerShipModalController($uibModalInstance, TrackerCommerceService, ToastService, order) {
        var m = this;
        m.order = order;
        m.form = { courier: '', tracking_code: '', tracking_url: '' };
        m.saving = false;

        m.submit = function() {
            var ok = ToastService.validateForm([
                { ok: !!m.form.courier,       field: 'field-trk-ship-courier',  label: 'Courier' },
                { ok: !!m.form.tracking_code, field: 'field-trk-ship-tracking', label: 'Tracking code' }
            ]);
            if (!ok) { return; }
            m.saving = true;
            TrackerCommerceService.SetOrderStatus(order.id, {
                status: 'shipped',
                courier: m.form.courier,
                tracking_code: m.form.tracking_code,
                tracking_url: m.form.tracking_url || null
            }).then(function(data) {
                m.saving = false;
                if (data && data.success === false) {
                    ToastService.error('Could not mark as shipped', data.message || 'Please try again.');
                    return;
                }
                ToastService.success('Order shipped', 'The club has been emailed the tracking details and fitting packs.');
                $uibModalInstance.close(true);
            });
        };
        m.cancel = function() { $uibModalInstance.dismiss('cancel'); };
    }

// ── Admin: resolve a return (B6) ──────────────────────────────────────────
app.controller('TrackerResolveReturnModalController', TrackerResolveReturnModalController);
    TrackerResolveReturnModalController.$inject = ['$uibModalInstance', 'TrackerCommerceService', 'FoxTrackerService', 'ToastService', 'rma'];
    function TrackerResolveReturnModalController($uibModalInstance, TrackerCommerceService, FoxTrackerService, ToastService, rma) {
        var m = this;
        m.rma = rma;
        m.resolutions = TrackerCommerceService.enums.resolution;
        m.pretty = function(str) { return str ? String(str).replace(/_/g, ' ') : ''; };
        m.form = { resolution: 'billing_stopped', resolution_notes: '', replacement_serial: '', fox_pick: null, restock: false };
        m.saving = false;
        m.trackers = [];

        // Restock only makes sense when the unit came back and isn't going
        // back into service — repaired / no-fault-found stay with the club.
        m.offerRestock = function() {
            return m.form.resolution !== 'repaired' && m.form.resolution !== 'no_fault_found';
        };

        FoxTrackerService.GetAll().then(function(data) {
            m.trackers = (data && data.trackers) || [];
        });
        m.trackerLabel = function(t) {
            if (!t) { return ''; }
            return t.imei + (t.label ? (' — ' + t.label) : '');
        };

        m.submit = function() {
            var checks = [{ ok: !!m.form.resolution, field: 'field-trk-resolve-resolution', label: 'A resolution' }];
            if (m.form.resolution === 'replaced') {
                checks.push({ ok: !!m.form.replacement_serial, field: 'field-trk-resolve-serial', label: 'The replacement serial' });
            }
            if (!ToastService.validateForm(checks)) { return; }
            var payload = {
                resolution: m.form.resolution,
                resolution_notes: m.form.resolution_notes || null
            };
            if (m.form.resolution === 'replaced') {
                payload.replacement_serial = m.form.replacement_serial;
                if (m.form.fox_pick) { payload.replacement_fox_tracker_id = m.form.fox_pick.id; }
            }
            if (m.offerRestock() && m.form.restock) { payload.restock = true; }
            m.saving = true;
            TrackerCommerceService.ResolveReturn(rma.id, payload).then(function(data) {
                m.saving = false;
                if (data && data.success === false) {
                    if (data.out_of_stock) {
                        // 'replaced' draws the new unit from stock — none left
                        ToastService.warning('No stock for a replacement', data.message || 'This version has no stock — receive a batch on the version page first.');
                        return;
                    }
                    ToastService.error('Could not resolve the return', data.message || 'Please try again.');
                    return;
                }
                ToastService.success('Return resolved', 'Case ' + rma.rma_number + ' has been closed.');
                $uibModalInstance.close(true);
            });
        };
        m.cancel = function() { $uibModalInstance.dismiss('cancel'); };
    }

// ── Admin: edit a unit (B4) ───────────────────────────────────────────────
app.controller('TrackerUnitEditModalController', TrackerUnitEditModalController);
    TrackerUnitEditModalController.$inject = ['$uibModalInstance', 'TrackerCommerceService', 'FoxTrackerService', 'ToastService', 'unit'];
    function TrackerUnitEditModalController($uibModalInstance, TrackerCommerceService, FoxTrackerService, ToastService, unit) {
        var m = this;
        m.unit = unit;
        m.form = {
            serial: unit.serial,
            notes: unit.notes,
            monthly_price: unit.monthly_price,
            vat_rate: unit.vat_rate
        };
        m.fox_pick = null;
        m.saving = false;
        m.trackers = [];

        FoxTrackerService.GetAll().then(function(data) {
            m.trackers = (data && data.trackers) || [];
            if (unit.fox_tracker_id) {
                for (var i = 0; i < m.trackers.length; i++) {
                    if (String(m.trackers[i].id) === String(unit.fox_tracker_id)) { m.fox_pick = m.trackers[i]; break; }
                }
            }
        });
        m.trackerLabel = function(t) {
            if (!t) { return ''; }
            return t.imei + (t.label ? (' — ' + t.label) : '');
        };

        m.submit = function() {
            var ok = ToastService.validateForm([
                { ok: !!m.form.serial, field: 'field-trk-unit-serial', label: 'Serial' }
            ]);
            if (!ok) { return; }
            var payload = {
                serial: m.form.serial,
                notes: m.form.notes || null,
                monthly_price: (m.form.monthly_price === '' || m.form.monthly_price === null) ? null : parseFloat(m.form.monthly_price),
                vat_rate: (m.form.vat_rate === '' || m.form.vat_rate === null) ? null : parseFloat(m.form.vat_rate)
            };
            if (m.fox_pick) { payload.fox_tracker_id = m.fox_pick.id; }
            m.saving = true;
            TrackerCommerceService.EditUnit(unit.id, payload).then(function(data) {
                m.saving = false;
                if (data && data.success === false) {
                    ToastService.error('Could not save the unit', data.message || 'Please try again.');
                    return;
                }
                ToastService.success('Unit saved', 'Tracker ' + m.form.serial + ' has been updated.');
                $uibModalInstance.close(true);
            });
        };
        m.cancel = function() { $uibModalInstance.dismiss('cancel'); };
    }

// input[type=date] needs a Date object model on this Angular version;
// the API speaks YYYY-MM-DD strings — convert in both directions.
function trkParseYmd(str) {
    if (!str) { return null; }
    if (str instanceof Date) { return str; }
    var parts = String(str).substring(0, 10).split('-');
    if (parts.length !== 3) { return null; }
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}
function trkFormatYmd(date) {
    if (!date) { return null; }
    if (!(date instanceof Date)) { return date; }
    var mm = ('0' + (date.getMonth() + 1)).slice(-2);
    var dd = ('0' + date.getDate()).slice(-2);
    return date.getFullYear() + '-' + mm + '-' + dd;
}

// ── Admin: create / edit a tracker version (B2) ───────────────────────────
app.controller('TrackerVersionModalController', TrackerVersionModalController);
    TrackerVersionModalController.$inject = ['$uibModalInstance', 'TrackerCommerceService', 'ToastService', 'version'];
    function TrackerVersionModalController($uibModalInstance, TrackerCommerceService, ToastService, version) {
        var m = this;
        m.is_edit = !!version;
        m.saving = false;
        m.form = version ? {
            code: version.code,
            name: version.name,
            description: version.description,
            hardware_revision: version.hardware_revision,
            fitting_notes: version.fitting_notes,
            status: version.status,
            released_at: trkParseYmd(version.released_at)
        } : {
            code: '', name: '', description: '', hardware_revision: '',
            fitting_notes: '', status: 'active', released_at: null
        };
        // Seed pricing (create only — one call sets version + first price row)
        m.seed_pricing = false;
        m.pricing = { unit_price: null, monthly_price: null, shipping_price: null, vat_rate: 20, currency: 'GBP', effective_from: null };

        m.submit = function() {
            var checks = [
                { ok: !!m.form.name, field: 'field-trk-ver-name', label: 'Name' }
            ];
            if (!m.is_edit) { checks.unshift({ ok: !!m.form.code, field: 'field-trk-ver-code', label: 'Code' }); }
            if (!m.is_edit && m.seed_pricing) {
                checks.push({ ok: m.pricing.unit_price !== null && m.pricing.unit_price !== '', field: 'field-trk-ver-unit-price', label: 'Unit price' });
                checks.push({ ok: m.pricing.monthly_price !== null && m.pricing.monthly_price !== '', field: 'field-trk-ver-monthly-price', label: 'Monthly price' });
            }
            if (!ToastService.validateForm(checks)) { return; }

            var payload = angular.copy(m.form);
            payload.released_at = trkFormatYmd(m.form.released_at);
            if (m.is_edit) { delete payload.code; }   // code is immutable
            if (!m.is_edit && m.seed_pricing) {
                payload.pricing = angular.copy(m.pricing);
                payload.pricing.effective_from = trkFormatYmd(m.pricing.effective_from);
            }

            m.saving = true;
            var call = m.is_edit
                ? TrackerCommerceService.EditVersion(version.id, payload)
                : TrackerCommerceService.CreateVersion(payload);
            call.then(function(data) {
                m.saving = false;
                if (data && data.success === false) {
                    ToastService.error('Could not save the version', data.message || 'Please try again.');
                    return;
                }
                ToastService.success(m.is_edit ? 'Version saved' : 'Version created', m.form.name + ' is ready.');
                $uibModalInstance.close(true);
            });
        };
        m.cancel = function() { $uibModalInstance.dismiss('cancel'); };
    }

// ── Admin: add / edit a pricing row (B2) ──────────────────────────────────
app.controller('TrackerPricingModalController', TrackerPricingModalController);
    TrackerPricingModalController.$inject = ['$uibModalInstance', 'TrackerCommerceService', 'ToastService', 'versionId', 'pricing'];
    function TrackerPricingModalController($uibModalInstance, TrackerCommerceService, ToastService, versionId, pricing) {
        var m = this;
        m.is_edit = !!pricing;
        m.saving = false;
        m.form = pricing ? {
            unit_price: pricing.unit_price,
            monthly_price: pricing.monthly_price,
            shipping_price: pricing.shipping_price,
            vat_rate: pricing.vat_rate,
            currency: pricing.currency,
            effective_from: trkParseYmd(pricing.effective_from)
        } : {
            unit_price: null, monthly_price: null, shipping_price: null,
            vat_rate: 20, currency: 'GBP', effective_from: null
        };

        m.submit = function() {
            var ok = ToastService.validateForm([
                { ok: m.form.unit_price !== null && m.form.unit_price !== '',       field: 'field-trk-price-unit',    label: 'Unit price' },
                { ok: m.form.monthly_price !== null && m.form.monthly_price !== '', field: 'field-trk-price-monthly', label: 'Monthly price' }
            ]);
            if (!ok) { return; }
            var payload = angular.copy(m.form);
            payload.effective_from = trkFormatYmd(m.form.effective_from);
            m.saving = true;
            var call;
            if (m.is_edit) {
                call = TrackerCommerceService.EditPricing(pricing.id, payload);
            } else {
                payload.tracker_version_id = versionId;
                payload.version_id = versionId;
                call = TrackerCommerceService.AddPricing(payload);
            }
            call.then(function(data) {
                m.saving = false;
                if (data && data.success === false) {
                    ToastService.error('Could not save the pricing', data.message || 'Please try again.');
                    return;
                }
                ToastService.success('Pricing saved', payload.effective_from ? ('Effective from ' + payload.effective_from + '.') : 'The price is in effect.');
                $uibModalInstance.close(true);
            });
        };
        m.cancel = function() { $uibModalInstance.dismiss('cancel'); };
    }

// ── Admin: manually set an invoice's status (B5) ──────────────────────────
app.controller('TrackerInvoiceStatusModalController', TrackerInvoiceStatusModalController);
    TrackerInvoiceStatusModalController.$inject = ['$uibModalInstance', 'TrackerCommerceService', 'ToastService', 'invoice'];
    function TrackerInvoiceStatusModalController($uibModalInstance, TrackerCommerceService, ToastService, invoice) {
        var m = this;
        m.invoice = invoice;
        m.form = { status: 'paid', reference: '', notes: '' };
        m.saving = false;

        // Cancelling a recurring invoice waives that month — the cron won't re-raise it
        m.waivesMonth = function() {
            return invoice.type === 'recurring' && m.form.status === 'cancelled';
        };

        m.submit = function() {
            m.saving = true;
            TrackerCommerceService.SetInvoiceStatus(invoice.id, {
                status: m.form.status,
                reference: m.form.reference || null,
                notes: m.form.notes || null
            }).then(function(data) {
                m.saving = false;
                if (data && data.success === false) {
                    ToastService.error('Could not update the invoice', data.message || 'Please try again.');
                    return;
                }
                ToastService.success('Invoice updated', invoice.invoice_number + ' is now ' + m.form.status + '.');
                $uibModalInstance.close(true);
            });
        };
        m.cancel = function() { $uibModalInstance.dismiss('cancel'); };
    }
