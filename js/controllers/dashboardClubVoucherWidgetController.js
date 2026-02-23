app.controller('DashboardClubVoucherWidgetController', DashboardClubVoucherWidgetController);

    DashboardClubVoucherWidgetController.$inject = ['VoucherWidgetService', 'ClubService', 'PaymentService', '$rootScope', '$scope', '$state', '$sce', 'ToastService'];
    function DashboardClubVoucherWidgetController(VoucherWidgetService, ClubService, PaymentService, $rootScope, $scope, $state, $sce, ToastService) {
        var vm = this;

        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user_id = $rootScope.globals.currentUser.id;

        // ── State ──
        vm.active_tab = 'setup';       // 'setup', 'customise', 'purchases'
        vm.loading = true;
        vm.saving = false;

        // ── Token state ──
        vm.token = null;
        vm.embed_code = '';
        vm.embed_copied = false;

        // ── Club info (for Stripe check) ──
        vm.club = null;
        vm.stripe_connected = false;
        vm.called_stripe_setup = false;

        // ── Settings state ──
        vm.settings = null;
        vm.settings_dirty = false;

        // ── Preview colours ──
        vm.font_options = [
            'Inter, system-ui, sans-serif',
            'Georgia, serif',
            'Helvetica Neue, Helvetica, Arial, sans-serif',
            'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            'Courier New, monospace',
            'Palatino Linotype, Book Antiqua, Palatino, serif'
        ];

        // ── Domains ──
        vm.domains_text = '';
        vm.domains_saving = false;

        // ── Purchases ──
        vm.purchases = [];
        vm.purchases_total = 0;
        vm.purchases_page = 1;
        vm.purchases_per_page = 25;
        vm.purchases_loading = false;
        vm.purchases_search = '';

        // ── Expanded purchase row ──
        vm.expanded_purchase_id = null;

        // ── Widget Preview / Test Mode ──
        vm.preview_loading = false;
        vm.preview_url = null;

        // ── Email Notifications ──
        vm.notifications = null;
        vm.notifications_loading = false;
        vm.notifications_saving = false;

        // ── Refund state ──
        vm.refund_in_progress_id = null;
        vm.refund_reason = '';
        vm.show_refund_confirm = null;

        // ═══════════════════════════════════════════════
        // TABS
        // ═══════════════════════════════════════════════

        vm.setTab = function(tab) {
            vm.active_tab = tab;

            if (tab === 'purchases' && vm.purchases.length === 0) {
                vm.loadPurchases();
            }
            if (tab === 'customise' && !vm.settings) {
                vm.loadSettings();
            }
            if (tab === 'setup' && vm.token && !vm.notifications) {
                vm.loadNotifications();
            }
        };

        // ═══════════════════════════════════════════════
        // INIT — Load club info + token
        // ═══════════════════════════════════════════════

        function init() {
            vm.loading = true;

            // Load club settings to check Stripe
            ClubService.GetById(vm.club_id)
                .then(function(data) {
                    vm.club = data;
                    vm.stripe_connected = !!(data && data.stripe_id && data.stripe_id !== '');

                    // Load widget token
                    return VoucherWidgetService.GetToken(vm.club_id);
                })
                .then(function(data) {
                    vm.loading = false;
                    if (data.success && data.token) {
                        vm.token = data.token;
                        vm.embed_code = data.token.embed_code || '';
                        // Parse allowed domains
                        if (data.token.allowed_domains) {
                            try {
                                var domains = JSON.parse(data.token.allowed_domains);
                                vm.domains_text = (domains || []).join('\n');
                            } catch(e) {
                                vm.domains_text = data.token.allowed_domains;
                            }
                        }
                        // Load notification preferences when token exists
                        vm.loadNotifications();
                    } else {
                        vm.token = null;
                        vm.embed_code = '';
                    }
                }, function() {
                    vm.loading = false;
                });
        }

        init();

        // ═══════════════════════════════════════════════
        // STRIPE SETUP (if not connected)
        // ═══════════════════════════════════════════════

        vm.setupStripe = function() {
            vm.called_stripe_setup = true;
            PaymentService.GenerateStripeLink(vm.club)
                .then(function(data) {
                    if (data.success && data.onboarding_link !== '') {
                        ToastService.success('Stripe Redirect', 'You will be redirected to Stripe — please complete the setup and you will be returned to ToAviate.');
                        window.location = data.onboarding_link;
                    } else {
                        ToastService.error('Stripe Error', "Stripe didn't seem to want to connect. Please try again.");
                        vm.called_stripe_setup = false;
                    }
                }, function() {
                    ToastService.error('Connection Error', 'Could not connect to the server.');
                    vm.called_stripe_setup = false;
                });
        };

        // ═══════════════════════════════════════════════
        // TOKEN MANAGEMENT
        // ═══════════════════════════════════════════════

        vm.generateToken = function() {
            vm.loading = true;
            VoucherWidgetService.GenerateToken(vm.club_id)
                .then(function(data) {
                    vm.loading = false;
                    if (data.success) {
                        vm.token = {
                            id: data.id,
                            token: data.token,
                            active: 1,
                            created_at: new Date().toISOString()
                        };
                        // Re-fetch to get the embed code
                        VoucherWidgetService.GetToken(vm.club_id)
                            .then(function(d) {
                                if (d.success && d.token) {
                                    vm.token = d.token;
                                    vm.embed_code = d.token.embed_code || '';
                                }
                            });
                        ToastService.success('Widget Enabled', 'Your voucher widget token has been generated. Copy the embed code to your website.');
                    } else {
                        ToastService.error('Error', data.message || 'Failed to generate token.');
                    }
                }, function() {
                    vm.loading = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
        };

        vm.regenerateToken = function() {
            if (!confirm('Are you sure? Regenerating the token will invalidate the old embed code. You will need to update it on your website.')) return;
            vm.generateToken();
        };

        vm.revokeToken = function() {
            if (!confirm('Are you sure you want to disable the voucher widget? It will immediately stop working on any website using the embed code.')) return;
            vm.loading = true;
            VoucherWidgetService.RevokeToken(vm.club_id)
                .then(function(data) {
                    vm.loading = false;
                    if (data.success) {
                        vm.token = null;
                        vm.embed_code = '';
                        ToastService.success('Widget Disabled', 'The voucher widget has been disabled and will no longer work on external websites.');
                    } else {
                        ToastService.error('Error', data.message || 'Failed to revoke token.');
                    }
                }, function() {
                    vm.loading = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
        };

        vm.copyEmbedCode = function() {
            var textarea = document.getElementById('vw_embed_code');
            if (textarea) {
                textarea.select();
                document.execCommand('copy');
                vm.embed_copied = true;
                ToastService.success('Copied!', 'Embed code copied to clipboard.');
                setTimeout(function() {
                    $scope.$apply(function() { vm.embed_copied = false; });
                }, 2500);
            }
        };

        // ═══════════════════════════════════════════════
        // WIDGET PREVIEW / TEST MODE
        // ═══════════════════════════════════════════════

        vm.openPreview = function() {
            vm.preview_loading = true;
            VoucherWidgetService.GetPreviewUrl(vm.club_id)
                .then(function(data) {
                    vm.preview_loading = false;
                    if (data.success && data.preview_url) {
                        vm.preview_url = $sce.trustAsResourceUrl(data.preview_url);
                        window.open(data.preview_url, '_blank', 'width=480,height=700,scrollbars=yes,resizable=yes');
                    } else {
                        ToastService.error('Error', data.message || 'Failed to generate preview URL.');
                    }
                }, function() {
                    vm.preview_loading = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
        };

        vm.openPreviewInline = function() {
            vm.preview_loading = true;
            VoucherWidgetService.GetPreviewUrl(vm.club_id)
                .then(function(data) {
                    vm.preview_loading = false;
                    if (data.success && data.preview_url) {
                        vm.preview_url = $sce.trustAsResourceUrl(data.preview_url);
                    } else {
                        ToastService.error('Error', data.message || 'Failed to generate preview URL.');
                    }
                }, function() {
                    vm.preview_loading = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
        };

        vm.closePreviewInline = function() {
            vm.preview_url = null;
        };

        // ═══════════════════════════════════════════════
        // EMAIL NOTIFICATIONS
        // ═══════════════════════════════════════════════

        vm.loadNotifications = function() {
            vm.notifications_loading = true;
            VoucherWidgetService.GetNotificationPreferences(vm.club_id)
                .then(function(data) {
                    vm.notifications_loading = false;
                    if (data.success && data.preferences) {
                        vm.notifications = data.preferences;
                        // Carry over fallback email returned by API
                        vm.notifications.fallback_email = data.fallback_email || '';
                    } else {
                        // Defaults
                        vm.notifications = {
                            email_on_purchase: 0,
                            email_on_refund: 0,
                            notification_email: '',
                            fallback_email: (vm.club && vm.club.settings && vm.club.settings.email) ? vm.club.settings.email : ''
                        };
                    }
                }, function() {
                    vm.notifications_loading = false;
                    // Defaults on error
                    vm.notifications = {
                        email_on_purchase: 0,
                        email_on_refund: 0,
                        notification_email: '',
                        fallback_email: (vm.club && vm.club.settings && vm.club.settings.email) ? vm.club.settings.email : ''
                    };
                });
        };

        vm.saveNotifications = function() {
            if (!vm.notifications) return;
            vm.notifications_saving = true;

            var payload = {
                email_on_purchase: vm.notifications.email_on_purchase ? 1 : 0,
                email_on_refund: vm.notifications.email_on_refund ? 1 : 0,
                notification_email: vm.notifications.notification_email || ''
            };

            VoucherWidgetService.UpdateNotificationPreferences(vm.club_id, payload)
                .then(function(data) {
                    vm.notifications_saving = false;
                    if (data.success) {
                        ToastService.success('Saved', 'Notification preferences updated.');
                    } else {
                        ToastService.error('Error', data.message || 'Failed to save notification preferences.');
                    }
                }, function() {
                    vm.notifications_saving = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
        };

        // ═══════════════════════════════════════════════
        // SETTINGS / CUSTOMISATION
        // ═══════════════════════════════════════════════

        vm.loadSettings = function() {
            VoucherWidgetService.GetSettings(vm.club_id)
                .then(function(data) {
                    if (data.success && data.settings) {
                        vm.settings = data.settings;
                    } else {
                        // Defaults
                        vm.settings = {
                            primary_colour: '#2563EB',
                            secondary_colour: '#1E40AF',
                            background_colour: '#FFFFFF',
                            text_colour: '#1F2937',
                            font_family: 'Inter, system-ui, sans-serif',
                            border_radius: 8,
                            show_descriptions: 1,
                            show_images: 1,
                            button_text: 'Buy Voucher',
                            success_message: null,
                            dark_mode: 0,
                            success_redirect_url: null
                        };
                    }
                    vm.settings_dirty = false;
                });
        };

        vm.markSettingsDirty = function() {
            vm.settings_dirty = true;
        };

        vm.saveSettings = function() {
            if (!vm.settings) return;
            vm.saving = true;

            var payload = {
                primary_colour: vm.settings.primary_colour,
                secondary_colour: vm.settings.secondary_colour,
                background_colour: vm.settings.background_colour,
                text_colour: vm.settings.text_colour,
                font_family: vm.settings.font_family,
                border_radius: vm.settings.border_radius,
                show_descriptions: vm.settings.show_descriptions ? 1 : 0,
                show_images: vm.settings.show_images ? 1 : 0,
                button_text: vm.settings.button_text || 'Buy Voucher',
                success_message: vm.settings.success_message || null,
                dark_mode: vm.settings.dark_mode ? 1 : 0,
                success_redirect_url: vm.settings.success_redirect_url || null
            };

            VoucherWidgetService.UpdateSettings(vm.club_id, payload)
                .then(function(data) {
                    vm.saving = false;
                    if (data.success) {
                        vm.settings_dirty = false;
                        ToastService.success('Saved', 'Widget appearance settings have been updated.');
                    } else {
                        ToastService.error('Error', data.message || 'Failed to save settings.');
                    }
                }, function() {
                    vm.saving = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
        };

        vm.resetSettings = function() {
            vm.settings.primary_colour = '#2563EB';
            vm.settings.secondary_colour = '#1E40AF';
            vm.settings.background_colour = '#FFFFFF';
            vm.settings.text_colour = '#1F2937';
            vm.settings.font_family = 'Inter, system-ui, sans-serif';
            vm.settings.border_radius = 8;
            vm.settings.show_descriptions = 1;
            vm.settings.show_images = 1;
            vm.settings.button_text = 'Buy Voucher';
            vm.settings.success_message = null;
            vm.settings.dark_mode = 0;
            vm.settings.success_redirect_url = null;
            vm.settings_dirty = true;
        };

        // ═══════════════════════════════════════════════
        // DARK MODE TOGGLE
        // ═══════════════════════════════════════════════

        vm.toggleDarkMode = function() {
            if (vm.settings.dark_mode) {
                // Switching TO dark mode — set dark defaults
                vm.settings.background_colour = '#1a1a2e';
                vm.settings.text_colour = '#e2e8f0';
                vm.settings.primary_colour = '#60a5fa';
                vm.settings.secondary_colour = '#3b82f6';
            } else {
                // Switching TO light mode — set light defaults
                vm.settings.background_colour = '#FFFFFF';
                vm.settings.text_colour = '#1F2937';
                vm.settings.primary_colour = '#2563EB';
                vm.settings.secondary_colour = '#1E40AF';
            }
            vm.settings_dirty = true;
        };

        // ═══════════════════════════════════════════════
        // ALLOWED DOMAINS
        // ═══════════════════════════════════════════════

        vm.saveDomains = function() {
            vm.domains_saving = true;
            var domains = vm.domains_text
                ? vm.domains_text.split('\n').map(function(d) { return d.trim(); }).filter(function(d) { return d !== ''; })
                : [];

            VoucherWidgetService.UpdateDomains(vm.club_id, domains.length > 0 ? domains : null)
                .then(function(data) {
                    vm.domains_saving = false;
                    if (data.success) {
                        ToastService.success('Saved', 'Allowed domains updated.');
                    } else {
                        ToastService.error('Error', data.message || 'Failed to update domains.');
                    }
                }, function() {
                    vm.domains_saving = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
        };

        // ═══════════════════════════════════════════════
        // PURCHASE HISTORY
        // ═══════════════════════════════════════════════

        vm.loadPurchases = function() {
            vm.purchases_loading = true;
            VoucherWidgetService.GetPurchases(vm.club_id, vm.purchases_page, vm.purchases_per_page)
                .then(function(data) {
                    vm.purchases_loading = false;
                    if (data.success) {
                        vm.purchases = data.purchases || [];
                        vm.purchases_total = data.total || 0;
                    }
                }, function() {
                    vm.purchases_loading = false;
                });
        };

        vm.nextPage = function() {
            if (vm.purchases_page * vm.purchases_per_page < vm.purchases_total) {
                vm.purchases_page++;
                vm.loadPurchases();
            }
        };

        vm.prevPage = function() {
            if (vm.purchases_page > 1) {
                vm.purchases_page--;
                vm.loadPurchases();
            }
        };

        vm.totalPages = function() {
            return Math.ceil(vm.purchases_total / vm.purchases_per_page) || 1;
        };

        vm.togglePurchaseDetail = function(purchase) {
            vm.expanded_purchase_id = (vm.expanded_purchase_id === purchase.id) ? null : purchase.id;
        };

        // ═══════════════════════════════════════════════
        // REFUND MANAGEMENT
        // ═══════════════════════════════════════════════

        vm.showRefundDialog = function(purchase, $event) {
            $event.stopPropagation();
            vm.show_refund_confirm = purchase.id;
            vm.refund_reason = '';
        };

        vm.cancelRefund = function($event) {
            if ($event) $event.stopPropagation();
            vm.show_refund_confirm = null;
            vm.refund_reason = '';
        };

        vm.processRefund = function(purchase, $event) {
            if ($event) $event.stopPropagation();
            vm.refund_in_progress_id = purchase.id;

            VoucherWidgetService.RefundPurchase(vm.club_id, purchase.id, vm.refund_reason)
                .then(function(data) {
                    vm.refund_in_progress_id = null;
                    vm.show_refund_confirm = null;
                    vm.refund_reason = '';

                    if (data.success) {
                        // Update the purchase status locally
                        purchase.payment_status = 'refunded';
                        purchase.refunded_at = new Date().toISOString();
                        ToastService.success('Refunded', 'The payment of ' + vm.formatCurrency(purchase.amount_paid, purchase.currency) + ' has been refunded via Stripe.');
                    } else {
                        ToastService.error('Refund Failed', data.message || 'Failed to process refund. Please try via Stripe dashboard.');
                    }
                }, function() {
                    vm.refund_in_progress_id = null;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
        };

        vm.canRefund = function(purchase) {
            return purchase.payment_status === 'succeeded' && purchase.stripe_payment_intent_id;
        };

        // ═══════════════════════════════════════════════
        // FILTERED PURCHASES (search)
        // ═══════════════════════════════════════════════

        vm.filteredPurchases = function() {
            if (!vm.purchases_search) return vm.purchases;
            var q = vm.purchases_search.toLowerCase();
            return vm.purchases.filter(function(p) {
                return (p.first_name + ' ' + p.last_name).toLowerCase().indexOf(q) > -1
                    || (p.email || '').toLowerCase().indexOf(q) > -1
                    || (p.experience_title || '').toLowerCase().indexOf(q) > -1
                    || (p.voucher_code || '').toLowerCase().indexOf(q) > -1;
            });
        };

        // ═══════════════════════════════════════════════
        // HELPERS
        // ═══════════════════════════════════════════════

        vm.formatDate = function(dateStr) {
            if (!dateStr) return '—';
            var d = new Date(dateStr);
            var day = ('0' + d.getDate()).slice(-2);
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var mon = months[d.getMonth()];
            var yr = d.getFullYear();
            var h = ('0' + d.getHours()).slice(-2);
            var m = ('0' + d.getMinutes()).slice(-2);
            return day + ' ' + mon + ' ' + yr + ', ' + h + ':' + m;
        };

        vm.formatCurrency = function(amount, currency) {
            if (!amount) return '—';
            var symbols = { GBP: '£', USD: '$', EUR: '€', AUD: 'A$', NZD: 'NZ$', CAD: 'C$', ZAR: 'R' };
            var sym = symbols[(currency || '').toUpperCase()] || (currency || '') + ' ';
            var num = parseFloat(amount);
            return sym + num.toFixed(2);
        };

        vm.paymentStatusClass = function(status) {
            switch (status) {
                case 'succeeded': return 'snazzy-table__badge--success';
                case 'pending':   return 'snazzy-table__badge--warning';
                case 'failed':    return 'snazzy-table__badge--danger';
                case 'refunded':  return 'snazzy-table__badge--info';
                default:          return '';
            }
        };

        $scope.back = function() {
            $rootScope.safeBack();
        };
    }
