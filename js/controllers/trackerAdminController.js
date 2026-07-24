// One controller serves every ToAviate-admin tracker-commerce screen; the
// screen is chosen by the route's data.screen (same architecture as
// SmsController). Screens: dashboard, versions, version_detail, orders,
// order_place, order_detail, units, invoices, returns, return_detail, audit.
//
// Access: ToAviate staff only — the backend is authoritative, this mirrors
// DashboardSuperAdminController's client-side bounce.
app.controller('TrackerAdminController', TrackerAdminController);
    TrackerAdminController.$inject = ['TrackerCommerceService', 'ClubService', 'PaymentModeService', 'ToastService', '$rootScope', '$scope', '$state', '$stateParams', '$location', '$timeout', '$uibModal'];
    function TrackerAdminController(TrackerCommerceService, ClubService, PaymentModeService, ToastService, $rootScope, $scope, $state, $stateParams, $location, $timeout, $uibModal) {
        var vm = this;
        vm.user = $rootScope.globals.currentUser;
        vm.is_toaviate_staff = !!(vm.user && vm.user.email && /@toaviate\.com$/i.test(vm.user.email));
        if (!vm.is_toaviate_staff) {
            $location.path('/dashboard');
            return;
        }

        vm.screen = $state.current.data.screen;
        vm.enums  = TrackerCommerceService.enums;
        vm.loading = false;

        // ── Sub-nav (shared partial views/manageclub/trackers/admin/_nav.html) ──
        vm.nav = [
            { screen: 'dashboard', state: 'dashboard.super_admin.tracker_commerce',        label: 'Overview', icon: 'fa-tachometer-alt' },
            { screen: 'orders',    state: 'dashboard.super_admin.tracker_orders',          label: 'Orders',   icon: 'fa-box-open' },
            { screen: 'units',     state: 'dashboard.super_admin.tracker_units',           label: 'Units',    icon: 'fa-map-marker-alt' },
            { screen: 'invoices',  state: 'dashboard.super_admin.tracker_invoices',        label: 'Invoices', icon: 'fa-file-invoice-dollar' },
            { screen: 'payment_errors', state: 'dashboard.super_admin.tracker_payment_errors', label: 'Payment Errors', icon: 'fa-exclamation-triangle' },
            { screen: 'returns',   state: 'dashboard.super_admin.tracker_returns',         label: 'Returns',  icon: 'fa-undo' },
            { screen: 'versions',  state: 'dashboard.super_admin.tracker_versions',        label: 'Versions', icon: 'fa-microchip' },
            { screen: 'audit',     state: 'dashboard.super_admin.tracker_audit',           label: 'Audit',    icon: 'fa-history' }
        ];
        var navAlias = { order_detail: 'orders', order_place: 'orders', return_detail: 'returns', version_detail: 'versions' };
        vm.navActive = navAlias[vm.screen] || vm.screen;
        vm.go = function(state, params) { $state.go(state, params || {}); };

        // ── Shared helpers ────────────────────────────────────────────────
        vm.pretty = function(str) { return str ? String(str).replace(/_/g, ' ') : ''; };
        vm.cur = function(code) {
            if (code === 'GBP' || !code) { return '£'; }
            if (code === 'EUR') { return '€'; }
            if (code === 'USD') { return '$'; }
            return code + ' ';
        };
        vm.orderBadge   = function(st) { return TrackerCommerceService.badges.order[st]   || 'trk-badge--grey'; };
        vm.invoiceBadge = function(st) { return TrackerCommerceService.badges.invoice[st] || 'trk-badge--grey'; };
        vm.unitBadge    = function(st) { return TrackerCommerceService.badges.unit[st]    || 'trk-badge--grey'; };
        vm.returnBadge  = function(st) { return TrackerCommerceService.badges.return[st]  || 'trk-badge--grey'; };
        vm.eventOutcomeBadge = function(o) { return TrackerCommerceService.badges.event_outcome[o] || 'trk-badge--grey'; };

        function toastFail(title, data) {
            ToastService.error(title, (data && data.message) || 'Something went wrong. Please try again.');
        }
        function todayYmd() {
            var d = new Date();
            var mm = ('0' + (d.getMonth() + 1)).slice(-2);
            var dd = ('0' + d.getDate()).slice(-2);
            return d.getFullYear() + '-' + mm + '-' + dd;
        }

        init();
        function init() {
            switch (vm.screen) {
                case 'dashboard':      initDashboard(); break;
                case 'versions':       initVersions(); break;
                case 'version_detail': initVersionDetail(); break;
                case 'orders':         initOrders(); break;
                case 'order_place':    initOrderPlace(); break;
                case 'order_detail':   initOrderDetail(); break;
                case 'units':          initUnits(); break;
                case 'invoices':       initInvoices(); break;
                case 'payment_errors': initPaymentErrors(); break;
                case 'returns':        initReturns(); break;
                case 'return_detail':  initReturnDetail(); break;
                case 'audit':          initAudit(); break;
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // DASHBOARD (B1)
        // ══════════════════════════════════════════════════════════════════
        function initDashboard() {
            vm.loading = true;
            TrackerCommerceService.AdminOverview().then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load the overview', data); return; }
                vm.overview = data;
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // VERSIONS & PRICING (B2)
        // ══════════════════════════════════════════════════════════════════
        function initVersions() {
            vm.loading = true;
            TrackerCommerceService.ListVersions().then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load versions', data); return; }
                vm.versions = (data && data.versions) || [];
            });
        }
        vm.openVersion = function(v) { $state.go('dashboard.super_admin.tracker_version_detail', { id: v.id }); };
        vm.newVersion = function() { openVersionModal(null, function() { initVersions(); }); };

        function openVersionModal(version, onSaved) {
            $uibModal.open({
                animation: true, size: 'lg', backdrop: 'static', windowClass: 'trk-modal',
                templateUrl: 'views/manageclub/trackers/modals/version_form.html',
                controller: 'TrackerVersionModalController', controllerAs: 'm',
                resolve: { version: function() { return version; } }
            }).result.then(function(changed) { if (changed && onSaved) { onSaved(); } }, function() {});
        }

        function initVersionDetail() {
            vm.version_id = $stateParams.id;
            vm.delete_open = false;
            vm.stock_form = { quantity: null, notes: '' };
            vm.stock_page = 1;
            vm.movements = [];
            loadVersion();
            loadStockMovements(true);
        }
        function loadVersion() {
            vm.loading = true;
            TrackerCommerceService.GetVersion(vm.version_id).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load the version', data); return; }
                vm.version = data.version || data;
            });
        }
        vm.editVersion = function() { openVersionModal(vm.version, loadVersion); };
        vm.deleteVersion = function() {
            vm.deleting = true;
            TrackerCommerceService.DeleteVersion(vm.version_id).then(function(data) {
                vm.deleting = false;
                if (data && data.success === false) { toastFail('Could not delete the version', data); return; }
                if (data.discontinued) {
                    ToastService.warning('Version discontinued', 'Units exist for this version, so it was discontinued rather than deleted.');
                    vm.delete_open = false;
                    loadVersion();
                } else {
                    ToastService.success('Version deleted', 'The version has been removed.');
                    $state.go('dashboard.super_admin.tracker_versions');
                }
            });
        };
        vm.addPricing = function() { openPricingModal(null); };
        vm.editPricing = function(row) {
            if (!row.is_future) { ToastService.warning('Price locked', 'Prices that are already in force cannot be edited — schedule a new price instead.'); return; }
            openPricingModal(row);
        };
        function openPricingModal(row) {
            $uibModal.open({
                animation: true, size: 'md', backdrop: 'static', windowClass: 'trk-modal',
                templateUrl: 'views/manageclub/trackers/modals/pricing_form.html',
                controller: 'TrackerPricingModalController', controllerAs: 'm',
                resolve: {
                    versionId: function() { return parseInt(vm.version_id, 10); },
                    pricing:   function() { return row; }
                }
            }).result.then(function(changed) { if (changed) { loadVersion(); } }, function() {});
        }
        vm.deletePricing = function(row) {
            row.deleting = true;
            TrackerCommerceService.DeletePricing(row.id).then(function(data) {
                row.deleting = false;
                if (data && data.success === false) { toastFail('Could not delete the price', data); return; }
                ToastService.success('Scheduled price removed', 'The future price row has been deleted.');
                loadVersion();
            });
        };

        // Fitting PDF — chunk-uploaded via ng-flow to /upload_documents.php,
        // then the temp filename is attached to the version.
        vm.processFittingPdf = function(files) {
            if (!files || !files.length) { return; }
            var parsed;
            try { parsed = JSON.parse(files[files.length - 1].file_return); }
            catch (e) { ToastService.error('Upload failed', 'The file could not be processed. Please try again.'); return; }
            vm.pdf_saving = true;
            TrackerCommerceService.SetVersionFittingPdf(vm.version_id, parsed.saved_url).then(function(data) {
                vm.pdf_saving = false;
                if (data && data.success === false) { toastFail('Could not attach the PDF', data); return; }
                ToastService.success('Fitting PDF attached', 'The fitting instructions are now available for this version.');
                loadVersion();
            });
        };
        vm.previewFittingPdf = function() {
            vm.pdf_downloading = true;
            TrackerCommerceService.DownloadVersionFittingPdf(vm.version_id, (vm.version && vm.version.code || 'version') + '-fitting.pdf').then(function(res) {
                vm.pdf_downloading = false;
                if (res && res.success === false) { toastFail('Download failed', res); }
            });
        };

        // ── Stock (B2): receive batches + running-balance ledger ──────────
        function loadStockMovements(reset) {
            vm.stock_loading = true;
            TrackerCommerceService.GetStockMovements(vm.version_id, vm.stock_page).then(function(data) {
                vm.stock_loading = false;
                if (data && data.success === false) { toastFail('Could not load the stock ledger', data); return; }
                var rows = (data && data.movements) || [];
                vm.movements = reset ? rows : vm.movements.concat(rows);
                vm.stock_has_more = rows.length > 0;
                if (data && data.stock_on_hand !== undefined) { vm.stock_on_hand = data.stock_on_hand; }
            });
        }
        vm.loadMoreStock = function() { vm.stock_page++; loadStockMovements(false); };
        vm.receiveStock = function() {
            var qty = parseInt(vm.stock_form.quantity, 10);
            var ok = ToastService.validateForm([
                { ok: !isNaN(qty) && qty !== 0, field: 'field-trk-stock-qty', label: 'A non-zero quantity' }
            ]);
            if (!ok) { return; }
            vm.stock_saving = true;
            TrackerCommerceService.AddStock({
                tracker_version_id: parseInt(vm.version_id, 10),
                quantity: qty,
                notes: vm.stock_form.notes || null
            }).then(function(data) {
                vm.stock_saving = false;
                if (data && data.success === false) { toastFail('Could not adjust the stock', data); return; }
                ToastService.success(qty > 0 ? 'Stock received' : 'Stock corrected',
                    (qty > 0 ? qty + ' unit' + (qty === 1 ? '' : 's') + ' added to stock.' : 'The stock level has been adjusted by ' + qty + '.'));
                vm.stock_form = { quantity: null, notes: '' };
                vm.stock_page = 1;
                loadStockMovements(true);
                loadVersion();
            });
        };
        vm.stockReasonLabel = function(reason) {
            var labels = {
                purchase: 'Batch received',
                order_reserved: 'Reserved for order',
                order_cancelled: 'Order cancelled',
                return_restock: 'Return restocked',
                replacement: 'Replacement issued',
                adjustment: 'Manual adjustment'
            };
            return labels[reason] || vm.pretty(reason);
        };

        // ══════════════════════════════════════════════════════════════════
        // ORDER PIPELINE (B3)
        // ══════════════════════════════════════════════════════════════════
        function initOrders() {
            vm.statusFilter = '';
            vm.search = '';
            vm.page = 1;
            vm.orders = [];
            vm.status_counts = {};
            loadAdminOrders(true);
        }
        function loadAdminOrders(reset) {
            vm.loading = true;
            TrackerCommerceService.AdminListOrders({ status: vm.statusFilter, page: vm.page }).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load orders', data); return; }
                var rows = (data && data.orders) || [];
                vm.orders = reset ? rows : vm.orders.concat(rows);
                vm.status_counts = (data && data.status_counts) || vm.status_counts;
                vm.has_more = rows.length > 0;
            });
        }
        vm.setOrderFilter = function(status) {
            vm.statusFilter = status;
            vm.page = 1;
            loadAdminOrders(true);
        };
        vm.loadMoreOrders = function() { vm.page++; loadAdminOrders(false); };
        vm.openAdminOrder = function(o) { $state.go('dashboard.super_admin.tracker_order_detail', { id: o.id }); };
        vm.orderItemsSummary = function(o) {
            return ((o && o.items) || []).map(function(it) { return it.quantity + '× ' + it.version_name; }).join(', ');
        };

        // ── Place an order on behalf of a club ────────────────────────────
        // Same catalogue → basket → quote → checkout flow as the club shop,
        // but the admin picks the club first (the backend's manager-or-admin
        // gate on quote/place lets ToAviate admins order for any club).
        function initOrderPlace() {
            vm.clubs = [];
            vm.club_pick = null;
            vm.catalogue = null;
            vm.basket = {};
            vm.quote = null;
            vm.quote_loading = false;
            vm.checkout_open = false;
            vm.placing = false;
            vm.notes = '';
            vm.shipping = {
                name: '', address_line1: '', address_line2: '', city: '', county: '',
                postcode: '', country: 'United Kingdom', phone: '', email: ''
            };
            vm.clubs_loading = true;
            ClubService.GetAll().then(function(data) {
                vm.clubs_loading = false;
                if (data && data.success === false) { toastFail('Could not load clubs', data); return; }
                vm.clubs = (data && data.clubs) || [];
            });
        }
        vm.onClubPicked = function() {
            vm.basket = {};
            vm.quote = null;
            vm.checkout_open = false;
            vm.place_profile = null;
            if (!vm.club_pick) { vm.catalogue = null; return; }
            vm.shipping.name = vm.club_pick.title || '';
            loadPlaceCatalogue();
            // The club's billing profile, so checkout can say how they'll pay
            vm.place_profile_loading = true;
            TrackerCommerceService.GetBillingProfile(vm.club_pick.id).then(function(data) {
                vm.place_profile_loading = false;
                if (data && data.success === false) { return; }
                vm.place_profile = data.profile;
            });
        };
        // Saved method a chained "place & collect" would charge. The club's
        // explicit preference wins; otherwise Direct Debit before card.
        vm.placeDefaultMethod = function() {
            var p = vm.place_profile;
            if (!p) { return null; }
            if (p.payment_method === 'card' && p.has_card) { return 'card'; }
            if (p.payment_method === 'direct_debit' && p.has_mandate) { return 'direct_debit'; }
            if (p.has_mandate) { return 'direct_debit'; }
            if (p.has_card) { return 'card'; }
            return null;
        };
        vm.placePayMethodLabel = function() {
            var m = vm.placeDefaultMethod();
            if (m === 'card') { return (vm.place_profile.card_brand || 'Card') + ' ending ' + (vm.place_profile.card_last4 || '····'); }
            if (m === 'direct_debit') { return 'Direct Debit' + (vm.place_profile.mandate_reference ? ' (' + vm.place_profile.mandate_reference + ')' : ''); }
            return '';
        };
        function loadPlaceCatalogue() {
            vm.catalogue_loading = true;
            TrackerCommerceService.GetCatalogue(vm.club_pick.id).then(function(data) {
                vm.catalogue_loading = false;
                if (data && data.success === false) { toastFail('Could not load the catalogue', data); return; }
                vm.catalogue = (data && data.catalogue) || [];
                clampBasketToStock();
            });
        }
        // Drop basket lines that no longer fit the (re-freshed) stock levels
        function clampBasketToStock() {
            (vm.catalogue || []).forEach(function(p) {
                if (!vm.basket[p.id]) { return; }
                if (p.out_of_stock) { delete vm.basket[p.id]; return; }
                if (p.available_stock !== undefined && p.available_stock !== null && vm.basket[p.id] > p.available_stock) {
                    vm.basket[p.id] = p.available_stock;
                }
            });
            refreshPlaceQuote();
        }
        vm.qtyOf = function(version) { return vm.basket[version.id] || 0; };
        vm.canAddMore = function(version) {
            if (version.out_of_stock) { return false; }
            if (version.available_stock === undefined || version.available_stock === null) { return true; }
            return vm.qtyOf(version) < version.available_stock;
        };
        vm.addToBasket = function(version) {
            if (!vm.canAddMore(version)) { return; }
            vm.basket[version.id] = (vm.basket[version.id] || 0) + 1;
            refreshPlaceQuote();
        };
        vm.removeFromBasket = function(version) {
            if (!vm.basket[version.id]) { return; }
            vm.basket[version.id]--;
            if (vm.basket[version.id] <= 0) { delete vm.basket[version.id]; }
            refreshPlaceQuote();
        };
        vm.basketItems = function() {
            var items = [];
            angular.forEach(vm.basket, function(qty, id) {
                if (qty > 0) { items.push({ tracker_version_id: parseInt(id, 10), quantity: qty }); }
            });
            return items;
        };
        vm.basketCount = function() {
            var n = 0;
            angular.forEach(vm.basket, function(qty) { n += qty; });
            return n;
        };
        vm.basketLine = function(id) {
            for (var i = 0; i < (vm.catalogue || []).length; i++) {
                if (String(vm.catalogue[i].id) === String(id)) { return vm.catalogue[i]; }
            }
            return {};
        };
        var placeQuoteTimer = null;
        function refreshPlaceQuote() {
            var items = vm.basketItems();
            if (!items.length) { vm.quote = null; vm.quote_loading = false; return; }
            vm.quote_loading = true;
            if (placeQuoteTimer) { $timeout.cancel(placeQuoteTimer); }
            placeQuoteTimer = $timeout(function() {
                TrackerCommerceService.QuoteOrder({ club_id: vm.club_pick.id, items: items }).then(function(data) {
                    vm.quote_loading = false;
                    if (data && data.success === false) {
                        if (data.out_of_stock) { handlePlaceOutOfStock(data); return; }
                        toastFail('Could not price the basket', data);
                        return;
                    }
                    vm.quote = data.quote;
                });
            }, 400);
        }
        // Stock ran out under us (someone else took the last units) — show the
        // backend's message and refresh the catalogue so the counts are honest.
        function handlePlaceOutOfStock(data) {
            vm.quote = null;
            ToastService.warning('Not enough stock', (data && data.message) || 'There is not enough stock for that quantity.');
            loadPlaceCatalogue();
        }
        vm.openCheckout = function() {
            vm.checkout_open = true;
            $timeout(function() {
                var el = document.getElementById('trk-checkout');
                if (el && el.scrollIntoView) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            }, 100);
        };
        // payNow: also collect the invoice from the club's saved method in the
        // same click (backend's pay gate is manager-or-admin, so this works)
        vm.placeOrder = function(payNow) {
            var sh = vm.shipping;
            var ok = ToastService.validateForm([
                { ok: !!sh.name,          field: 'field-trk-ship-name',     label: 'Recipient name' },
                { ok: !!sh.address_line1, field: 'field-trk-ship-address1', label: 'Address line 1' },
                { ok: !!sh.city,          field: 'field-trk-ship-city',     label: 'City' },
                { ok: !!sh.postcode,      field: 'field-trk-ship-postcode', label: 'Postcode' },
                { ok: !!sh.country,       field: 'field-trk-ship-country',  label: 'Country' }
            ]);
            if (!ok) { return; }
            var items = vm.basketItems();
            if (!items.length) { ToastService.warning('Basket is empty', 'Add at least one tracker before placing the order.'); return; }
            var method = payNow ? vm.placeDefaultMethod() : null;
            vm.placing = true;
            TrackerCommerceService.PlaceOrder({ club_id: vm.club_pick.id, items: items, shipping: sh, notes: vm.notes || null }).then(function(data) {
                if (data && data.success === false) {
                    vm.placing = false;
                    if (data.out_of_stock) { handlePlaceOutOfStock(data); return; }
                    toastFail('Could not place the order', data);
                    return;
                }
                if (!method || !data.invoice_id) {
                    vm.placing = false;
                    ToastService.success('Order placed', 'Order ' + data.order_number + ' has been created for ' + vm.club_pick.title + ' — the invoice is ready to pay.');
                    $state.go('dashboard.super_admin.tracker_order_detail', { id: data.order_id });
                    return;
                }
                TrackerCommerceService.PayInvoice(data.invoice_id, method).then(function(pay) {
                    vm.placing = false;
                    if (pay && pay.success === false) {
                        ToastService.warning('Order placed, but the collection failed', pay.message || 'You can retry from the order or mark it paid by bank transfer.');
                    } else if (pay.status === 'payment_pending') {
                        ToastService.success('Order placed — collection started', 'Order ' + data.order_number + ' is in; the Direct Debit collection is in flight.');
                    } else {
                        ToastService.success('Order placed & paid', 'Order ' + data.order_number + ' for ' + vm.club_pick.title + ' is paid.');
                    }
                    $state.go('dashboard.super_admin.tracker_order_detail', { id: data.order_id });
                });
            });
        };

        function initOrderDetail() {
            vm.order_id = $stateParams.id;
            vm.mark_paid_open = false;
            vm.mark_paid_reference = '';
            vm.cancel_open = false;
            vm.cancel_reason = '';
            loadOrder();
        }
        function loadOrder() {
            vm.loading = true;
            TrackerCommerceService.GetOrder(vm.order_id).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load the order', data); return; }
                vm.order = data.order || data;
            });
        }
        vm.unallocatedCount = function() {
            return ((vm.order && vm.order.units) || []).filter(function(u) { return !u.serial; }).length;
        };
        vm.markPaid = function() {
            vm.marking_paid = true;
            TrackerCommerceService.MarkOrderPaid(vm.order_id, vm.mark_paid_reference).then(function(data) {
                vm.marking_paid = false;
                if (data && data.success === false) { toastFail('Could not mark as paid', data); return; }
                vm.mark_paid_open = false;
                ToastService.success('Order marked paid', 'Payment has been recorded against the order.');
                loadOrder();
            });
        };
        vm.cancelOrder = function() {
            vm.cancelling = true;
            TrackerCommerceService.CancelOrder(vm.order_id, vm.cancel_reason).then(function(data) {
                vm.cancelling = false;
                if (data && data.success === false) { toastFail('Could not cancel the order', data); return; }
                vm.cancel_open = false;
                ToastService.success('Order cancelled', 'The order has been cancelled.');
                loadOrder();
            });
        };
        vm.setOrderStatus = function(status) {
            vm.status_saving = true;
            TrackerCommerceService.SetOrderStatus(vm.order_id, { status: status }).then(function(data) {
                vm.status_saving = false;
                if (data && data.success === false) { toastFail('Could not update the order', data); return; }
                ToastService.success('Order updated', 'The order is now ' + vm.pretty(status) + '.');
                loadOrder();
            });
        };
        vm.openAllocate = function() {
            $uibModal.open({
                animation: true, size: 'lg', backdrop: 'static', windowClass: 'trk-modal',
                templateUrl: 'views/manageclub/trackers/modals/allocate.html',
                controller: 'TrackerAllocateModalController', controllerAs: 'm',
                resolve: { order: function() { return vm.order; } }
            }).result.then(function(changed) { if (changed) { loadOrder(); } }, function() {});
        };
        vm.openShip = function() {
            $uibModal.open({
                animation: true, size: 'md', backdrop: 'static', windowClass: 'trk-modal',
                templateUrl: 'views/manageclub/trackers/modals/ship.html',
                controller: 'TrackerShipModalController', controllerAs: 'm',
                resolve: { order: function() { return vm.order; } }
            }).result.then(function(changed) { if (changed) { loadOrder(); } }, function() {});
        };

        // ══════════════════════════════════════════════════════════════════
        // UNITS MANAGER (B4)
        // ══════════════════════════════════════════════════════════════════
        function initUnits() {
            vm.statusFilter = '';
            vm.search = '';
            vm.page = 1;
            vm.units = [];
            vm.status_counts = {};
            loadAdminUnits(true);
        }
        function loadAdminUnits(reset) {
            vm.loading = true;
            TrackerCommerceService.AdminListUnits({ status: vm.statusFilter, search: vm.search, page: vm.page }).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load units', data); return; }
                var rows = (data && data.units) || [];
                vm.units = reset ? rows : vm.units.concat(rows);
                vm.status_counts = (data && data.status_counts) || vm.status_counts;
                vm.has_more = rows.length > 0;
            });
        }
        vm.setUnitFilter = function(status) { vm.statusFilter = status; vm.page = 1; loadAdminUnits(true); };
        vm.searchUnits = function() { vm.page = 1; loadAdminUnits(true); };
        vm.loadMoreUnits = function() { vm.page++; loadAdminUnits(false); };
        vm.editUnit = function(u) {
            $uibModal.open({
                animation: true, size: 'md', backdrop: 'static', windowClass: 'trk-modal',
                templateUrl: 'views/manageclub/trackers/modals/unit_edit.html',
                controller: 'TrackerUnitEditModalController', controllerAs: 'm',
                resolve: { unit: function() { return u; } }
            }).result.then(function(changed) { if (changed) { loadAdminUnits(true); } }, function() {});
        };
        vm.pauseBilling = function(u) {
            u.busy = true;
            TrackerCommerceService.PauseBilling(u.id).then(function(data) {
                u.busy = false;
                if (data && data.success === false) { toastFail('Could not pause billing', data); return; }
                ToastService.success('Billing paused', (u.serial || 'The unit') + ' will not be billed until resumed.');
                loadAdminUnits(true);
            });
        };
        vm.resumeBilling = function(u) {
            u.busy = true;
            TrackerCommerceService.ResumeBilling(u.id).then(function(data) {
                u.busy = false;
                if (data && data.success === false) { toastFail('Could not resume billing', data); return; }
                ToastService.success('Billing resumed', (u.serial || 'The unit') + ' is billable again.');
                loadAdminUnits(true);
            });
        };
        vm.retireUnit = function(u) {
            u.busy = true;
            TrackerCommerceService.RetireUnit(u.id).then(function(data) {
                u.busy = false;
                u.retire_open = false;
                if (data && data.success === false) { toastFail('Could not retire the unit', data); return; }
                ToastService.success('Unit retired', (u.serial || 'The unit') + ' has been retired — billing ends today.');
                loadAdminUnits(true);
            });
        };

        // ══════════════════════════════════════════════════════════════════
        // INVOICES & PAYMENTS (B5)
        // ══════════════════════════════════════════════════════════════════
        function initInvoices() {
            vm.statusFilter = '';
            vm.typeFilter = '';
            vm.search = '';
            vm.page = 1;
            vm.invoices = [];
            vm.status_counts = {};
            // GoCardless webhook event log (collapsed until opened)
            vm.events_open = false;
            vm.events_loaded = false;
            vm.events = [];
            vm.events_page = 1;
            vm.event_type_filter = '';
            vm.event_club_pick = null;
            vm.event_clubs = [];
            // Stripe event log — twin section (collapsed until opened)
            vm.sevents_open = false;
            vm.sevents_loaded = false;
            vm.sevents = [];
            vm.sevents_page = 1;
            vm.sevent_type_filter = '';
            vm.sevent_club_pick = null;
            loadAdminInvoices(true);
        }
        function loadAdminInvoices(reset) {
            vm.loading = true;
            TrackerCommerceService.AdminListInvoices({ status: vm.statusFilter, type: vm.typeFilter, page: vm.page }).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load invoices', data); return; }
                var rows = (data && data.invoices) || [];
                vm.invoices = reset ? rows : vm.invoices.concat(rows);
                vm.status_counts = (data && data.status_counts) || vm.status_counts;
                vm.has_more = rows.length > 0;
            });
        }
        vm.setInvoiceFilter = function(status) { vm.statusFilter = status; vm.page = 1; loadAdminInvoices(true); };
        vm.setInvoiceType = function(type) { vm.typeFilter = type; vm.page = 1; loadAdminInvoices(true); };
        vm.loadMoreInvoices = function() { vm.page++; loadAdminInvoices(false); };
        vm.toggleInvoice = function(inv) {
            inv.show_more = !inv.show_more;
            if (inv.show_more && !inv.detail && !inv.detail_loading) {
                inv.detail_loading = true;
                TrackerCommerceService.GetInvoice(inv.id).then(function(data) {
                    inv.detail_loading = false;
                    if (data && data.success === false) { return; }
                    inv.detail = data.invoice || data;
                });
            }
        };
        vm.downloadInvoice = function(inv) {
            inv.downloading = true;
            TrackerCommerceService.DownloadInvoicePdf(inv.id, (inv.invoice_number || 'tracker-invoice') + '.pdf').then(function(res) {
                inv.downloading = false;
                if (res && res.success === false) { toastFail('Download failed', res); }
            });
        };
        // Reload whichever invoice list the current screen shows (the invoice
        // actions are shared between the Invoices and Payment Errors screens)
        function reloadInvoiceContext() {
            if (vm.screen === 'payment_errors') { loadPaymentErrors(); }
            else { loadAdminInvoices(true); }
        }
        vm.retryPayment = function(inv) {
            inv.paying = true;
            TrackerCommerceService.PayInvoice(inv.id).then(function(data) {
                inv.paying = false;
                // 3DS challenges can only be answered by the cardholder — an
                // admin retry can surface one but never complete it.
                if (data && data.requires_action) {
                    ToastService.warning('Cardholder authentication required', "The bank wants the club's cardholder to authenticate (3D Secure) — nothing has been charged. The club has been emailed a link to complete it from their billing page.");
                    reloadInvoiceContext();
                    return;
                }
                if (data && data.success === false) { toastFail('Collection failed', data); reloadInvoiceContext(); return; }
                if (data.status === 'payment_pending') {
                    ToastService.success('Collection started', 'The collection is in flight.');
                } else {
                    ToastService.success('Invoice paid', 'The payment went through.');
                }
                reloadInvoiceContext();
            });
        };
        vm.openInvoiceStatus = function(inv) {
            $uibModal.open({
                animation: true, size: 'md', backdrop: 'static', windowClass: 'trk-modal',
                templateUrl: 'views/manageclub/trackers/modals/invoice_status.html',
                controller: 'TrackerInvoiceStatusModalController', controllerAs: 'm',
                resolve: { invoice: function() { return inv; } }
            }).result.then(function(changed) { if (changed) { reloadInvoiceContext(); } }, function() {});
        };
        // Per-club auto-billing toggle (admins only)
        vm.loadClubProfile = function(inv) {
            if (inv.profile || inv.profile_loading) { inv.show_profile = !inv.show_profile; return; }
            inv.profile_loading = true;
            inv.show_profile = true;
            TrackerCommerceService.GetBillingProfile(inv.club_id).then(function(data) {
                inv.profile_loading = false;
                if (data && data.success === false) { toastFail('Could not load the billing profile', data); return; }
                inv.profile = data.profile;
            });
        };
        vm.toggleAutoBilling = function(inv) {
            var next = !inv.profile.auto_billing_enabled;
            TrackerCommerceService.UpdateBillingProfile(inv.club_id, { auto_billing_enabled: next }).then(function(data) {
                if (data && data.success === false) { toastFail('Could not update auto-billing', data); return; }
                inv.profile.auto_billing_enabled = next;
                ToastService.success('Auto-billing ' + (next ? 'enabled' : 'paused'), (inv.club_title || 'The club') + (next ? ' will be charged automatically again.' : ' will not be auto-charged.'));
            });
        };

        // Sandbox ↔ live switch for a club, reusing the platform payment-mode
        // modal (server gate: PAYMENT_MODE_SUPER_ADMINS). Tracker billing
        // follows clubs.payment_mode like everything else.
        vm.openPaymentModeSwitch = function(inv) {
            if (inv.mode_loading) { return; }
            inv.mode_loading = true;
            PaymentModeService.GetStatus(inv.club_id).then(function(status) {
                inv.mode_loading = false;
                if (!status || status.success === false || !status.payment_mode) {
                    toastFail('Could not load the payment mode', status);
                    return;
                }
                $uibModal.open({
                    animation: true, size: 'md', backdrop: 'static',
                    templateUrl: 'views/modals/payment_mode_switch.html',
                    controller: 'PaymentModeSwitchModalCtrl', controllerAs: 'vm',
                    resolve: {
                        status:    function() { return status; },
                        club_name: function() { return inv.club_title || 'this club'; }
                    }
                }).result.then(function(data) {
                    ToastService.success('Payment mode switched', (inv.club_title || 'The club') + ' is now in ' + ((data && data.payment_mode) || 'the new') + ' mode — saved payment methods for the old mode were removed, so the club must re-add theirs.');
                    inv.profile = null;   // force a fresh profile load
                    inv.show_profile = false;
                    vm.loadClubProfile(inv);
                }, function() {});
            });
        };

        // ── GoCardless webhook event log (B5) — "did GC tell us about this
        //    payment?" without opening the GoCardless dashboard ─────────────
        vm.toggleEvents = function() {
            vm.events_open = !vm.events_open;
            if (vm.events_open && !vm.events_loaded) {
                vm.events_loaded = true;
                ClubService.GetAll().then(function(data) {
                    if (data && data.success === false) { return; }
                    vm.event_clubs = (data && data.clubs) || [];
                });
                loadWebhookEvents(true);
            }
        };
        vm.refreshEvents = function() {
            vm.events_page = 1;
            loadWebhookEvents(true);
        };
        // ui-select's allow-clear doesn't fire on-select, so watch the model
        // to catch both picking and clearing the club filter
        $scope.$watch('vm.event_club_pick', function(next, prev) {
            if (next === prev || !vm.events_loaded) { return; }
            loadWebhookEvents(true);
        });
        function loadWebhookEvents(reset) {
            if (reset) { vm.events_page = 1; }
            vm.events_loading = true;
            TrackerCommerceService.ListWebhookEvents({
                club_id: vm.event_club_pick ? vm.event_club_pick.id : null,
                resource_type: vm.event_type_filter || null,
                page: vm.events_page
            }).then(function(data) {
                vm.events_loading = false;
                if (data && data.success === false) { toastFail('Could not load the payment events', data); return; }
                var rows = (data && data.events) || [];
                vm.events = reset ? rows : (vm.events || []).concat(rows);
                vm.events_has_more = rows.length > 0;
            });
        }
        vm.setEventType = function(type) {
            vm.event_type_filter = type;
            loadWebhookEvents(true);
        };
        vm.loadMoreEvents = function() { vm.events_page++; loadWebhookEvents(false); };
        // Deep-link an event's invoice into the invoice list above
        vm.openEventInvoice = function(ev) {
            if (!ev.invoice_number) { return; }
            vm.search = ev.invoice_number;
            var match = null;
            for (var i = 0; i < (vm.invoices || []).length; i++) {
                if (vm.invoices[i].invoice_number === ev.invoice_number) { match = vm.invoices[i]; break; }
            }
            if (match && !match.show_more) { vm.toggleInvoice(match); }
            $timeout(function() {
                var el = document.getElementById('trk-admin-invoices');
                if (el && el.scrollIntoView) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            }, 50);
            if (!match) {
                ToastService.warning('Not in the loaded list', ev.invoice_number + ' is not on the current page — the list above is now filtered to it; clear a status/type filter or load more if it does not appear.');
            }
        };

        // ── Stripe event log — twin of the GoCardless section: "did Stripe
        //    tell us about this payment?" without opening the dashboard ─────
        vm.toggleStripeEvents = function() {
            vm.sevents_open = !vm.sevents_open;
            if (vm.sevents_open && !vm.sevents_loaded) {
                vm.sevents_loaded = true;
                if (!vm.event_clubs.length) {
                    ClubService.GetAll().then(function(data) {
                        if (data && data.success === false) { return; }
                        vm.event_clubs = (data && data.clubs) || [];
                    });
                }
                loadStripeEvents(true);
            }
        };
        vm.refreshStripeEvents = function() { loadStripeEvents(true); };
        $scope.$watch('vm.sevent_club_pick', function(next, prev) {
            if (next === prev || !vm.sevents_loaded) { return; }
            loadStripeEvents(true);
        });
        function loadStripeEvents(reset) {
            if (reset) { vm.sevents_page = 1; }
            vm.sevents_loading = true;
            TrackerCommerceService.AdminStripeEvents({
                club_id: vm.sevent_club_pick ? vm.sevent_club_pick.id : null,
                event_type: vm.sevent_type_filter || null,
                page: vm.sevents_page
            }).then(function(data) {
                vm.sevents_loading = false;
                if (data && data.success === false) { toastFail('Could not load the Stripe events', data); return; }
                var rows = (data && data.events) || [];
                vm.sevents = reset ? rows : (vm.sevents || []).concat(rows);
                vm.sevents_has_more = rows.length > 0;
            });
        }
        vm.applyStripeEventType = function() { loadStripeEvents(true); };
        vm.loadMoreStripeEvents = function() { vm.sevents_page++; loadStripeEvents(false); };

        // ══════════════════════════════════════════════════════════════════
        // PAYMENT ERRORS — every tracker collection problem across all clubs
        // without opening the Stripe/GoCardless dashboards
        // ══════════════════════════════════════════════════════════════════
        function initPaymentErrors() {
            vm.search = '';
            vm.pe = null;
            loadPaymentErrors();
        }
        function loadPaymentErrors() {
            vm.pe_loading = true;
            TrackerCommerceService.AdminPaymentErrors().then(function(data) {
                vm.pe_loading = false;
                if (data && data.success === false) { toastFail('Could not load the payment errors', data); return; }
                vm.pe = data;
            });
        }
        vm.reloadPaymentErrors = loadPaymentErrors;
        vm.peAllClear = function() {
            return vm.pe && !(vm.pe.invoices || []).length &&
                   !(vm.pe.gcl_event_errors || []).length &&
                   !(vm.pe.stripe_event_errors || []).length;
        };
        vm.peStatColour = function(status) {
            if (status === 'failed') { return 'trk-stat--red'; }
            if (status === 'requires_action') { return 'trk-stat--amber'; }
            if (status === 'payment_pending') { return 'trk-stat--violet'; }
            return '';   // collecting → default brand tile
        };

        // ══════════════════════════════════════════════════════════════════
        // RETURNS QUEUE (B6)
        // ══════════════════════════════════════════════════════════════════
        function initReturns() {
            vm.statusFilter = 'open';
            vm.search = '';
            vm.page = 1;
            vm.returns = [];
            vm.status_counts = {};
            loadAdminReturns(true);
        }
        function loadAdminReturns(reset) {
            vm.loading = true;
            TrackerCommerceService.AdminListReturns({ status: vm.statusFilter, page: vm.page }).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load returns', data); return; }
                var rows = (data && data.returns) || [];
                vm.returns = reset ? rows : vm.returns.concat(rows);
                vm.status_counts = (data && data.status_counts) || vm.status_counts;
                vm.has_more = rows.length > 0;
            });
        }
        vm.setReturnFilter = function(status) { vm.statusFilter = status; vm.page = 1; loadAdminReturns(true); };
        vm.loadMoreReturns = function() { vm.page++; loadAdminReturns(false); };
        vm.openAdminReturn = function(r) { $state.go('dashboard.super_admin.tracker_return_detail', { id: r.id }); };

        function initReturnDetail() {
            vm.return_id = $stateParams.id;
            vm.reply = '';
            loadReturn();
        }
        function loadReturn() {
            vm.loading = true;
            TrackerCommerceService.GetReturn(vm.return_id).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load the return', data); return; }
                vm.rma = data.return || data;
            });
        }
        vm.sendReply = function() {
            if (!vm.reply) { return; }
            vm.replying = true;
            TrackerCommerceService.ReplyReturn(vm.return_id, vm.reply).then(function(data) {
                vm.replying = false;
                if (data && data.success === false) { toastFail('Could not send the message', data); return; }
                vm.reply = '';
                loadReturn();
            });
        };
        // reported → acknowledged → approved → awaiting_shipment → in_transit → received
        var pipeline = ['reported', 'acknowledged', 'approved', 'awaiting_shipment', 'in_transit', 'received'];
        vm.nextReturnStatus = function() {
            var i = pipeline.indexOf(vm.rma && vm.rma.status);
            return (i > -1 && i < pipeline.length - 1) ? pipeline[i + 1] : null;
        };
        vm.returnIsOpen = function() {
            return vm.rma && ['resolved', 'rejected', 'cancelled'].indexOf(vm.rma.status) === -1;
        };
        vm.setReturnStatus = function(status) {
            var payload = { status: status };
            if (status === 'received') { payload.received_at = todayYmd(); }
            vm.status_saving = true;
            TrackerCommerceService.SetReturnStatus(vm.return_id, payload).then(function(data) {
                vm.status_saving = false;
                if (data && data.success === false) { toastFail('Could not update the return', data); return; }
                if (status === 'received') {
                    ToastService.success('Unit received', 'Billing for this unit has stopped.');
                } else {
                    ToastService.success('Return updated', 'The case is now ' + vm.pretty(status) + '.');
                }
                loadReturn();
            });
        };
        vm.openResolve = function() {
            $uibModal.open({
                animation: true, size: 'md', backdrop: 'static', windowClass: 'trk-modal',
                templateUrl: 'views/manageclub/trackers/modals/resolve_return.html',
                controller: 'TrackerResolveReturnModalController', controllerAs: 'm',
                resolve: { rma: function() { return vm.rma; } }
            }).result.then(function(changed) { if (changed) { loadReturn(); } }, function() {});
        };

        // ══════════════════════════════════════════════════════════════════
        // AUDIT VIEWER (B7)
        // ══════════════════════════════════════════════════════════════════
        function initAudit() {
            vm.entityFilter = '';
            vm.page = 1;
            vm.entries = [];
            loadAudit(true);
        }
        function loadAudit(reset) {
            vm.loading = true;
            TrackerCommerceService.AuditRecent({ entity_type: vm.entityFilter, page: vm.page }).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load the audit log', data); return; }
                var rows = (data && data.entries) || [];
                vm.entries = reset ? rows : vm.entries.concat(rows);
                vm.has_more = rows.length > 0;
            });
        }
        vm.setEntityFilter = function(type) { vm.entityFilter = type; vm.page = 1; loadAudit(true); };
        vm.loadMoreAudit = function() { vm.page++; loadAudit(false); };
        vm.snapshot = function(obj) {
            if (!obj) { return ''; }
            if (typeof obj === 'string') {
                try { return JSON.stringify(JSON.parse(obj), null, 2); } catch (e) { return obj; }
            }
            return JSON.stringify(obj, null, 2);
        };
    }
