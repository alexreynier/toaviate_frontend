// One controller serves every club-side tracker-commerce screen; the screen is
// chosen by the route's data.screen (same architecture as SmsController).
// Screens: shop, orders, order_detail, units, unit_detail, billing, dd_confirm,
//          returns, return_detail, activity.
app.controller('TrackerClubController', TrackerClubController);
    TrackerClubController.$inject = ['TrackerCommerceService', 'MaintenanceOrganisationService', 'ToastService', '$rootScope', '$scope', '$state', '$stateParams', '$location', '$timeout', '$uibModal'];
    function TrackerClubController(TrackerCommerceService, MaintenanceOrganisationService, ToastService, $rootScope, $scope, $state, $stateParams, $location, $timeout, $uibModal) {
        var vm = this;
        vm.screen  = $state.current.data.screen;
        vm.user    = $rootScope.globals.currentUser;
        vm.club_id = vm.user.current_club_admin.id;
        vm.enums   = TrackerCommerceService.enums;
        vm.loading = false;

        // ── Sub-nav (shared partial views/manageclub/trackers/_nav.html) ──
        vm.nav = [
            { screen: 'shop',     state: 'dashboard.manage_club.trackers_shop',     label: 'Shop',        icon: 'fa-shopping-cart' },
            { screen: 'orders',   state: 'dashboard.manage_club.trackers_orders',   label: 'Orders',      icon: 'fa-box-open' },
            { screen: 'units',    state: 'dashboard.manage_club.trackers',          label: 'My Trackers', icon: 'fa-map-marker-alt' },
            { screen: 'billing',  state: 'dashboard.manage_club.trackers_billing',  label: 'Billing',     icon: 'fa-file-invoice-dollar' },
            { screen: 'returns',  state: 'dashboard.manage_club.trackers_returns',  label: 'Returns',     icon: 'fa-undo' },
            { screen: 'activity', state: 'dashboard.manage_club.trackers_activity', label: 'Activity',    icon: 'fa-history' }
        ];
        // Detail screens highlight their parent tab
        var navAlias = { order_detail: 'orders', unit_detail: 'units', dd_confirm: 'billing', return_detail: 'returns' };
        vm.navActive = navAlias[vm.screen] || vm.screen;
        vm.go = function(state, params) { $state.go(state, params || {}); };

        // ── Shared helpers ────────────────────────────────────────────────
        vm.pretty = function(str) {
            if (!str) { return ''; }
            return String(str).replace(/_/g, ' ');
        };
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

        function toastFail(title, data) {
            ToastService.error(title, (data && data.message) || 'Something went wrong. Please try again.');
        }

        init();
        function init() {
            switch (vm.screen) {
                case 'shop':          initShop(); break;
                case 'orders':        initOrders(); break;
                case 'order_detail':  initOrderDetail(); break;
                case 'units':         initUnits(); break;
                case 'unit_detail':   initUnitDetail(); break;
                case 'billing':       initBilling(); break;
                case 'dd_confirm':    initDdConfirm(); break;
                case 'returns':       initReturns(); break;
                case 'return_detail': initReturnDetail(); break;
                case 'activity':      initActivity(); break;
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // SHOP (A1) — catalogue → basket → live quote → checkout
        // ══════════════════════════════════════════════════════════════════
        function initShop() {
            vm.basket = {};            // tracker_version_id → quantity
            vm.quote = null;
            vm.quote_loading = false;
            vm.checkout_open = false;
            vm.placing = false;
            vm.shipping = {
                name: vm.user.current_club_admin.title || '',
                address_line1: '', address_line2: '', city: '', county: '',
                postcode: '', country: 'United Kingdom',
                phone: '', email: vm.user.email || ''
            };
            vm.notes = '';
            vm.loading = true;
            TrackerCommerceService.GetCatalogue(vm.club_id).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load the catalogue', data); return; }
                vm.catalogue = (data && data.catalogue) || [];
            });
            loadProfile();   // so the checkout can show how the invoice will be paid
        }
        // The saved method the one-click "place & pay" will charge. The club's
        // explicit preference wins; otherwise Direct Debit before card.
        vm.defaultPayMethod = function() {
            if (!vm.profile) { return null; }
            if (vm.profile.payment_method === 'card' && vm.profile.has_card) { return 'card'; }
            if (vm.profile.payment_method === 'direct_debit' && vm.profile.has_mandate) { return 'direct_debit'; }
            if (vm.profile.has_mandate) { return 'direct_debit'; }
            if (vm.profile.has_card) { return 'card'; }
            return null;
        };
        vm.payMethodLabel = function() {
            var m = vm.defaultPayMethod();
            if (m === 'card') { return (vm.profile.card_brand || 'Card') + ' ending ' + (vm.profile.card_last4 || '····'); }
            if (m === 'direct_debit') { return 'Direct Debit' + (vm.profile.mandate_reference ? ' (' + vm.profile.mandate_reference + ')' : ''); }
            return '';
        };
        // Re-fetch stock levels after an out-of-stock refusal and drop basket
        // lines that no longer fit (someone else may have taken the last units)
        function reloadCatalogue() {
            TrackerCommerceService.GetCatalogue(vm.club_id).then(function(data) {
                if (data && data.success === false) { return; }
                vm.catalogue = (data && data.catalogue) || [];
                vm.catalogue.forEach(function(p) {
                    if (!vm.basket[p.id]) { return; }
                    if (p.out_of_stock) { delete vm.basket[p.id]; return; }
                    if (p.available_stock != null && vm.basket[p.id] > p.available_stock) {
                        vm.basket[p.id] = p.available_stock;
                    }
                });
                refreshQuote();
            });
        }
        function handleOutOfStock(data) {
            vm.quote = null;
            ToastService.warning('Not enough stock', (data && data.message) || 'There is not enough stock for that quantity.');
            reloadCatalogue();
        }

        vm.qtyOf = function(version) { return vm.basket[version.id] || 0; };
        vm.canAddMore = function(version) {
            if (version.out_of_stock) { return false; }
            if (version.available_stock == null) { return true; }
            return vm.qtyOf(version) < version.available_stock;
        };
        vm.addToBasket = function(version) {
            if (!vm.canAddMore(version)) { return; }
            vm.basket[version.id] = (vm.basket[version.id] || 0) + 1;
            refreshQuote();
        };
        vm.removeFromBasket = function(version) {
            if (!vm.basket[version.id]) { return; }
            vm.basket[version.id]--;
            if (vm.basket[version.id] <= 0) { delete vm.basket[version.id]; }
            refreshQuote();
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
            // Catalogue entry for a basket key (used by the basket summary rows)
            for (var i = 0; i < (vm.catalogue || []).length; i++) {
                if (String(vm.catalogue[i].id) === String(id)) { return vm.catalogue[i]; }
            }
            return {};
        };

        var quoteTimer = null;
        function refreshQuote() {
            var items = vm.basketItems();
            if (!items.length) { vm.quote = null; vm.quote_loading = false; return; }
            vm.quote_loading = true;
            if (quoteTimer) { $timeout.cancel(quoteTimer); }
            quoteTimer = $timeout(function() {
                TrackerCommerceService.QuoteOrder({ club_id: vm.club_id, items: items }).then(function(data) {
                    vm.quote_loading = false;
                    if (data && data.success === false) {
                        if (data.out_of_stock) { handleOutOfStock(data); return; }
                        toastFail('Could not price your basket', data);
                        return;
                    }
                    vm.quote = data.quote;
                });
            }, 400);
        }

        vm.openCheckout = function() {
            vm.checkout_open = true;
            $timeout(function() {
                var el = document.getElementById('trk-checkout');
                if (el && el.scrollIntoView) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            }, 100);
        };

        // payNow: also charge the saved method in the same click (the invoice
        // only exists once the order is placed, so this is place → pay chained)
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
            if (!items.length) { ToastService.warning('Basket is empty', 'Add at least one tracker before checking out.'); return; }
            var method = payNow ? vm.defaultPayMethod() : null;
            vm.placing = true;
            TrackerCommerceService.PlaceOrder({ club_id: vm.club_id, items: items, shipping: sh, notes: vm.notes || null }).then(function(data) {
                if (data && data.success === false) {
                    vm.placing = false;
                    if (data.out_of_stock) { handleOutOfStock(data); return; }
                    toastFail('Could not place the order', data);
                    return;
                }
                if (!method || !data.invoice_id) {
                    vm.placing = false;
                    ToastService.success('Order placed', 'Order ' + data.order_number + ' has been created — the invoice is ready to pay.');
                    $state.go('dashboard.manage_club.trackers_order_detail', { id: data.order_id });
                    return;
                }
                TrackerCommerceService.PayInvoice(data.invoice_id, method).then(function(pay) {
                    vm.placing = false;
                    if (pay && pay.success === false) {
                        // The order exists — send them to it so they can retry
                        ToastService.warning('Order placed, but payment failed', pay.message || 'You can retry the payment from the order.');
                    } else if (pay.status === 'payment_pending') {
                        ToastService.success('Order placed — collection started', 'Order ' + data.order_number + " is in. The Direct Debit collection is in flight — we'll email you when it completes.");
                    } else {
                        ToastService.success('Order placed & paid', 'Order ' + data.order_number + ' is paid — thank you!');
                    }
                    $state.go('dashboard.manage_club.trackers_order_detail', { id: data.order_id });
                });
            });
        };

        // ══════════════════════════════════════════════════════════════════
        // ORDERS (A2)
        // ══════════════════════════════════════════════════════════════════
        function initOrders() {
            vm.statusFilter = '';
            vm.search = '';
            vm.loading = true;
            TrackerCommerceService.ListClubOrders(vm.club_id).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load orders', data); return; }
                vm.orders = (data && data.orders) || [];
            });
        }
        vm.openOrder = function(o) { $state.go('dashboard.manage_club.trackers_order_detail', { id: o.id }); };
        vm.orderItemsSummary = function(o) {
            return ((o && o.items) || []).map(function(it) { return it.quantity + '× ' + it.version_name; }).join(', ');
        };

        // ── Order detail ──────────────────────────────────────────────────
        function initOrderDetail() {
            vm.order_id = $stateParams.id;
            vm.cancel_open = false;
            vm.cancel_reason = '';
            vm.confirm_delivery_open = false;
            loadOrder();
            loadProfile(); // needed to know which payment methods are available for "Pay invoice"
        }
        function loadOrder() {
            vm.loading = true;
            TrackerCommerceService.GetOrder(vm.order_id).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load the order', data); return; }
                vm.order = data.order || data;
            });
        }
        vm.orderIsPayable = function() {
            return vm.order && (vm.order.invoice_status === 'issued' || vm.order.invoice_status === 'failed');
        };
        vm.orderCancellable = function() {
            return vm.order && (vm.order.status === 'pending' || vm.order.status === 'awaiting_payment');
        };
        vm.cancelOrder = function() {
            vm.cancelling = true;
            TrackerCommerceService.CancelOrder(vm.order_id, vm.cancel_reason).then(function(data) {
                vm.cancelling = false;
                if (data && data.success === false) { toastFail('Could not cancel the order', data); return; }
                vm.cancel_open = false;
                ToastService.success('Order cancelled', 'Order ' + vm.order.order_number + ' has been cancelled.');
                loadOrder();
            });
        };
        vm.confirmDelivery = function() {
            vm.confirming_delivery = true;
            TrackerCommerceService.ConfirmDelivery(vm.order_id).then(function(data) {
                vm.confirming_delivery = false;
                if (data && data.success === false) { toastFail('Could not confirm delivery', data); return; }
                vm.confirm_delivery_open = false;
                ToastService.success('Delivery confirmed', 'Monthly billing starts on the 1st of next month.');
                loadOrder();
            });
        };

        // ══════════════════════════════════════════════════════════════════
        // BILLING (A3) — profile, card (Stripe SetupIntent), DD (GoCardless),
        //                invoices + pay now + PDF
        // ══════════════════════════════════════════════════════════════════
        function loadProfile() {
            vm.profile_loading = true;
            return TrackerCommerceService.GetBillingProfile(vm.club_id).then(function(data) {
                vm.profile_loading = false;
                if (data && data.success === false) { toastFail('Could not load billing details', data); return; }
                vm.profile = data.profile;
                vm.profile_edit = {
                    billing_email: vm.profile.billing_email,
                    billing_day: vm.profile.billing_day,
                    payment_method: vm.profile.payment_method
                };
            });
        }
        function loadInvoices() {
            vm.invoices_loading = true;
            TrackerCommerceService.ListClubInvoices(vm.club_id).then(function(data) {
                vm.invoices_loading = false;
                if (data && data.success === false) { toastFail('Could not load invoices', data); return; }
                vm.invoices = (data && data.invoices) || [];
            });
        }
        function initBilling() {
            vm.billing_days = [];
            for (var d = 1; d <= 28; d++) { vm.billing_days.push(d); }
            vm.card_setup_open = false;
            vm.card_setup_loading = false;
            vm.remove_card_open = false;
            vm.remove_dd_open = false;
            loadProfile().then(handleStripeReturn);
            loadInvoices();
        }

        // Returned from a Stripe 3DS redirect during card setup?
        function handleStripeReturn() {
            var si = $location.search().setup_intent;
            if (!si) { return; }
            var status = $location.search().redirect_status;
            $location.search('setup_intent', null);
            $location.search('setup_intent_client_secret', null);
            $location.search('redirect_status', null);
            if (status && status !== 'succeeded') {
                ToastService.error('Card not saved', 'The card could not be verified. Please try again.');
                return;
            }
            TrackerCommerceService.CardConfirm(vm.club_id, si).then(function(data) {
                if (data && data.success === false) { toastFail('Card not saved', data); return; }
                ToastService.success('Card saved', 'Your ' + (data.card_brand || 'card') + ' ending ' + (data.card_last4 || '') + ' is ready to use.');
                loadProfile();
            });
        }

        vm.saveProfile = function() {
            var ok = ToastService.validateForm([
                { ok: !!vm.profile_edit.billing_email, field: 'field-trk-billing-email', label: 'Billing email' }
            ]);
            if (!ok) { return; }
            vm.profile_saving = true;
            TrackerCommerceService.UpdateBillingProfile(vm.club_id, vm.profile_edit).then(function(data) {
                vm.profile_saving = false;
                if (data && data.success === false) { toastFail('Could not save billing details', data); return; }
                ToastService.success('Billing details saved', 'Your billing preferences have been updated.');
                loadProfile();
            });
        };

        // ── Add a card (Stripe Payment Element, setup mode) ───────────────
        var stripeCtx = null;
        function withStripe(cb, attempt) {
            // stripe.js is loaded async in index.html — poll until it's there
            if (typeof Stripe !== 'undefined') { cb(); return; }
            if ((attempt || 0) > 25) {
                vm.card_setup_loading = false;
                ToastService.error('Payments unavailable', 'The payment library failed to load. Please refresh the page and try again.');
                return;
            }
            $timeout(function() { withStripe(cb, (attempt || 0) + 1); }, 300);
        }
        vm.startCardSetup = function() {
            vm.card_setup_loading = true;
            vm.card_error = '';
            TrackerCommerceService.CardSetup(vm.club_id).then(function(data) {
                if (data && data.success === false) {
                    vm.card_setup_loading = false;
                    toastFail('Could not start card setup', data);
                    return;
                }
                vm.card_setup = { setup_intent_id: data.setup_intent_id };
                var key = data.stripe_publishable || (vm.profile && vm.profile.stripe_publishable);
                withStripe(function() {
                    var stripe = Stripe(key);
                    var elements = stripe.elements({ clientSecret: data.client_secret });
                    var paymentElement = elements.create('payment', { layout: 'tabs' });
                    stripeCtx = { stripe: stripe, elements: elements };
                    vm.card_setup_open = true;
                    vm.card_setup_loading = false;
                    $timeout(function() { paymentElement.mount('#trk-payment-element'); }, 50);
                });
            });
        };
        vm.cancelCardSetup = function() {
            vm.card_setup_open = false;
            stripeCtx = null;
        };
        vm.submitCard = function() {
            if (!stripeCtx) { return; }
            vm.card_saving = true;
            vm.card_error = '';
            stripeCtx.stripe.confirmSetup({
                elements: stripeCtx.elements,
                confirmParams: { return_url: window.location.href },
                redirect: 'if_required'
            }).then(function(result) {
                $timeout(function() {   // re-enter the digest from the Stripe promise
                    if (result.error) {
                        vm.card_saving = false;
                        vm.card_error = result.error.message;
                        return;
                    }
                    TrackerCommerceService.CardConfirm(vm.club_id, vm.card_setup.setup_intent_id).then(function(data) {
                        vm.card_saving = false;
                        if (data && data.success === false) { toastFail('Card not saved', data); return; }
                        vm.card_setup_open = false;
                        stripeCtx = null;
                        ToastService.success('Card saved', 'Your ' + (data.card_brand || 'card') + ' ending ' + (data.card_last4 || '') + ' is ready to use.');
                        loadProfile();
                    });
                });
            });
        };
        vm.removeCard = function() {
            vm.removing_card = true;
            TrackerCommerceService.RemoveCard(vm.club_id).then(function(data) {
                vm.removing_card = false;
                if (data && data.success === false) { toastFail('Could not remove the card', data); return; }
                vm.remove_card_open = false;
                ToastService.success('Card removed', 'The saved card has been removed.');
                loadProfile();
            });
        };

        // ── Direct Debit (GoCardless hosted flow) ─────────────────────────
        vm.startDdSetup = function() {
            vm.dd_loading = true;
            var returnUrl = window.location.origin + '/dashboard/manage_club/trackers/billing/dd_confirm';
            TrackerCommerceService.DdSetup(vm.club_id, returnUrl).then(function(data) {
                if (data && data.success === false) {
                    vm.dd_loading = false;
                    toastFail('Could not start Direct Debit setup', data);
                    return;
                }
                window.location = data.link;   // → GoCardless hosted mandate page
            });
        };
        vm.removeDd = function() {
            vm.removing_dd = true;
            TrackerCommerceService.RemoveDd(vm.club_id).then(function(data) {
                vm.removing_dd = false;
                if (data && data.success === false) { toastFail('Could not cancel the mandate', data); return; }
                vm.remove_dd_open = false;
                ToastService.success('Direct Debit cancelled', 'The mandate has been cancelled.');
                loadProfile();
            });
        };

        function initDdConfirm() {
            vm.dd_state = 'working';
            var flowId = $location.search().redirect_flow_id;
            if (!flowId) { vm.dd_state = 'failed'; vm.dd_message = 'No Direct Debit reference was supplied on the return link.'; return; }
            TrackerCommerceService.DdConfirm(vm.club_id, flowId).then(function(data) {
                if (data && data.success === false) {
                    vm.dd_state = 'failed';
                    vm.dd_message = data.message || 'The Direct Debit could not be confirmed.';
                    return;
                }
                vm.dd_state = 'done';
                vm.dd_mandate = data.mandate_reference;
                vm.dd_already = !!data.already_confirmed;
            });
        }

        // ── Invoices ──────────────────────────────────────────────────────
        vm.invoicePayable = function(inv) { return inv && (inv.status === 'issued' || inv.status === 'failed'); };
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
        vm.payInvoice = function(inv, method) {
            inv.paying = true;
            TrackerCommerceService.PayInvoice(inv.id, method).then(function(data) {
                inv.paying = false;
                if (data && data.success === false) { toastFail('Payment failed', data); refreshAfterPay(); return; }
                if (data.status === 'payment_pending') {
                    ToastService.success('Collection in progress', "The Direct Debit collection has started — we'll email you when it completes.");
                } else {
                    ToastService.success('Invoice paid', 'Thank you — the payment went through.');
                }
                refreshAfterPay();
            });
        };
        function refreshAfterPay() {
            if (vm.screen === 'billing') { loadInvoices(); }
            if (vm.screen === 'order_detail') { loadOrder(); }
        }
        vm.hasPaymentMethod = function() {
            return !!(vm.profile && (vm.profile.has_card || vm.profile.has_mandate));
        };
        // Pay the one-off invoice from the order-detail screen
        vm.payOrderInvoice = function(method) {
            if (!vm.order || !vm.order.invoice_id) { return; }
            vm.order_paying = true;
            TrackerCommerceService.PayInvoice(vm.order.invoice_id, method).then(function(data) {
                vm.order_paying = false;
                if (data && data.success === false) { toastFail('Payment failed', data); loadOrder(); return; }
                if (data.status === 'payment_pending') {
                    ToastService.success('Collection in progress', "The Direct Debit collection has started — we'll email you when it completes.");
                } else {
                    ToastService.success('Invoice paid', 'Thank you — the payment went through.');
                }
                loadOrder();
            });
        };

        // ══════════════════════════════════════════════════════════════════
        // UNITS (A4) + maintenance access (A6)
        // ══════════════════════════════════════════════════════════════════
        function initUnits() {
            vm.search = '';
            vm.statusFilter = '';
            vm.loading = true;
            TrackerCommerceService.ListClubUnits(vm.club_id).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load your trackers', data); return; }
                vm.units = (data && data.units) || [];
                vm.monthly_summary = data && data.monthly_summary;
            });
        }
        vm.openUnit = function(u) { $state.go('dashboard.manage_club.trackers_unit_detail', { id: u.tracker_unit_id || u.id }); };
        vm.downloadFittingPdf = function(u) {
            u.downloading = true;
            var unitId = u.tracker_unit_id || u.id;
            TrackerCommerceService.DownloadUnitFittingPdf(unitId, 'fitting-' + (u.serial || unitId) + '.pdf').then(function(res) {
                u.downloading = false;
                if (res && res.success === false) { toastFail('Download failed', res); }
            });
        };
        vm.reportProblem = function(u) {
            $uibModal.open({
                animation: true,
                size: 'md',
                backdrop: 'static',
                windowClass: 'trk-modal',
                templateUrl: 'views/manageclub/trackers/modals/report_return.html',
                controller: 'TrackerReturnReportModalController',
                controllerAs: 'm',
                resolve: {
                    unit: function() { return u; }
                }
            }).result.then(function(changed) {
                if (changed) {
                    if (vm.screen === 'units') { initUnits(); }
                    if (vm.screen === 'unit_detail') { loadUnit(); }
                }
            }, function() {});
        };

        // ── Unit detail ───────────────────────────────────────────────────
        function initUnitDetail() {
            vm.unit_id = $stateParams.id;
            vm.link_pick = null;
            vm.link_notes = '';
            vm.invite_open = false;
            vm.invite = { email: '', organisation_name: '', message: '' };
            loadUnit();
            loadOrgs();
            loadInvites();
        }
        function loadUnit() {
            vm.loading = true;
            TrackerCommerceService.GetUnit(vm.unit_id).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load the tracker', data); return; }
                vm.unit = data.unit || data;
            });
        }
        function loadOrgs() {
            MaintenanceOrganisationService.ListAll().then(function(res) {
                var list = (res && (res.organisations || res.data || res)) || [];
                vm.maintenance_orgs = angular.isArray(list) ? list : [];
            });
        }
        function loadInvites() {
            TrackerCommerceService.ListMaintenanceInvites(vm.club_id).then(function(data) {
                if (data && data.success === false) { return; }
                vm.pending_invites = (data && data.invites) || [];
            });
        }
        vm.linkOrg = function() {
            if (!vm.link_pick) { ToastService.warning('Pick an organisation', 'Choose a maintenance organisation to link first.'); return; }
            vm.linking = true;
            TrackerCommerceService.AssignMaintenanceOrg({
                maintenance_org_id: vm.link_pick.id,
                tracker_unit_ids: [parseInt(vm.unit_id, 10)],
                notes: vm.link_notes || null
            }).then(function(data) {
                vm.linking = false;
                if (data && data.success === false) { toastFail('Could not link the organisation', data); return; }
                ToastService.success('Organisation linked', vm.link_pick.title + ' now has access to the fitting pack for this tracker.');
                vm.link_pick = null;
                vm.link_notes = '';
                loadUnit();
            });
        };
        vm.unlinkOrg = function(link) {
            link.unlinking = true;
            TrackerCommerceService.UnassignMaintenanceOrg(link.link_id || link.id).then(function(data) {
                link.unlinking = false;
                if (data && data.success === false) { toastFail('Could not unlink the organisation', data); return; }
                ToastService.success('Organisation unlinked', 'Access has been removed.');
                loadUnit();
            });
        };
        vm.sendInvite = function() {
            var ok = ToastService.validateForm([
                { ok: !!vm.invite.email && vm.invite.email.indexOf('@') > 0, field: 'field-trk-invite-email', label: 'A valid email address' }
            ]);
            if (!ok) { return; }
            vm.inviting = true;
            TrackerCommerceService.InviteMaintenanceOrg({
                email: vm.invite.email,
                organisation_name: vm.invite.organisation_name || null,
                message: vm.invite.message || null,
                tracker_unit_ids: [parseInt(vm.unit_id, 10)]
            }).then(function(data) {
                vm.inviting = false;
                if (data && data.success === false) {
                    if (data.error === 'email_taken') {
                        ToastService.warning('Already on ToAviate', 'That organisation is already registered — pick them from the "Link an organisation" list instead.');
                    } else {
                        toastFail('Could not send the invite', data);
                    }
                    return;
                }
                ToastService.success('Invite sent', 'We emailed ' + vm.invite.email + ' an invitation to join and take on this tracker.');
                vm.invite = { email: '', organisation_name: '', message: '' };
                vm.invite_open = false;
                loadInvites();
            });
        };
        vm.revokeInvite = function(inv) {
            inv.revoking = true;
            TrackerCommerceService.RevokeMaintenanceInvite(inv.id).then(function(data) {
                inv.revoking = false;
                if (data && data.success === false) { toastFail('Could not revoke the invite', data); return; }
                ToastService.success('Invite revoked', 'The invitation is no longer valid.');
                loadInvites();
            });
        };

        // ══════════════════════════════════════════════════════════════════
        // RETURNS (A5)
        // ══════════════════════════════════════════════════════════════════
        function initReturns() {
            vm.statusFilter = '';
            vm.search = '';
            vm.loading = true;
            TrackerCommerceService.ListClubReturns(vm.club_id).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load returns', data); return; }
                vm.returns = (data && data.returns) || [];
            });
        }
        vm.openReturn = function(r) { $state.go('dashboard.manage_club.trackers_return_detail', { id: r.id }); };
        vm.returnStatusHint = function(status) {
            var hints = {
                reported: 'We have your report and will be in touch.',
                acknowledged: 'ToAviate is looking into it.',
                approved: 'The return has been approved.',
                awaiting_shipment: 'Please ship the unit back to us.',
                in_transit: 'On its way back to us.',
                received: 'We have the unit — billing has stopped.',
                resolved: 'This case is closed.',
                rejected: 'The request was not accepted.',
                cancelled: 'You withdrew this request.'
            };
            return hints[status] || '';
        };

        function initReturnDetail() {
            vm.return_id = $stateParams.id;
            vm.reply = '';
            vm.withdraw_open = false;
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
        vm.canWithdraw = function() {
            return vm.rma && ['reported', 'acknowledged', 'approved'].indexOf(vm.rma.status) > -1;
        };
        vm.withdrawReturn = function() {
            vm.withdrawing = true;
            TrackerCommerceService.WithdrawReturn(vm.return_id).then(function(data) {
                vm.withdrawing = false;
                if (data && data.success === false) { toastFail('Could not withdraw the request', data); return; }
                vm.withdraw_open = false;
                ToastService.success('Request withdrawn', 'The return request has been cancelled.');
                loadReturn();
            });
        };

        // ══════════════════════════════════════════════════════════════════
        // ACTIVITY — the club-visible audit trail
        // ══════════════════════════════════════════════════════════════════
        function initActivity() {
            vm.entries = [];
            vm.audit_page = 1;
            vm.audit_has_more = true;
            loadActivity();
        }
        function loadActivity() {
            vm.audit_loading = true;
            TrackerCommerceService.AuditClub(vm.club_id, vm.audit_page).then(function(data) {
                vm.audit_loading = false;
                if (data && data.success === false) { toastFail('Could not load activity', data); return; }
                var entries = (data && data.entries) || [];
                vm.entries = vm.entries.concat(entries);
                vm.audit_has_more = entries.length > 0;
            });
        }
        vm.loadMoreActivity = function() {
            vm.audit_page++;
            loadActivity();
        };
        vm.snapshot = function(obj) {
            if (!obj) { return ''; }
            if (typeof obj === 'string') {
                try { return JSON.stringify(JSON.parse(obj), null, 2); } catch (e) { return obj; }
            }
            return JSON.stringify(obj, null, 2);
        };
    }
