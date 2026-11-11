// Manage Club AREA HUBS (2026-11-10, batch 19 — step 2 of the Manage Club
// restructure, ops/plans/PROPOSAL_MANAGE_CLUB_STRUCTURE.md §5).
//
// Four abstract parent states — dashboard.manage_club.ops_hub / accounting_hub /
// admin_hub / super_admin_hub — share this controller and
// views/manageclub/area_hub.html: an area bar (Back to Manage Club, the area
// name) + the area's TAB row + a PAGE row for the active tab, above the nested
// <ui-view> that renders the page. Every existing Manage Club page keeps its
// state name, URL, template and controller; it was only re-parented into one
// hub (`parent:` in app.js) and tagged `data.area`. A page that two areas use
// (Vouchers, Trackers, Invoices, Settings cards…) lives under ONE hub and the
// other hubs link to it (`area` on the page entry below = the hub it opens in).
//
// Step 4 (roles) switches the Manage Club guard on `data.area` and hides the
// tabs an account doesn't hold — nothing here is a permission check today.
//
// Settings cards: until step 3 splits views/manageclub/settings.html, a tab
// that owns a Settings card links to the page with `?card=<id>`
// (`url: '/settings?card'`); the hub scrolls to that card's `id` on arrival.
// The entered area, remembered for the browser session (file-level: the tile directive
// below runs before any hub has been built).
var MC_AREA_KEY = 'ta_mc_area';
function mcRememberedArea() { try { return sessionStorage.getItem(MC_AREA_KEY) || null; } catch (e) { return null; } }
function mcRememberArea(a) { try { if (a) { sessionStorage.setItem(MC_AREA_KEY, a); } } catch (e) { /* private mode */ } }

// ── The tab → page map, ONE place for the hub bars, the home tiles' order and the
//    home page's flat view ──
var MC_PREFIX = 'dashboard.manage_club.';


// A page entry: label, icon, sref (+ params), states = every state name the
// entry is "active" for ($state.includes — dotted children count), area = the
// hub that page actually opens in when it is not this one (cross-link).
function mcPage(label, icon, sref, states, area, params) {
    return { label: label, icon: icon, sref: sref, states: states || [sref], area: area || null, params: params || null };
}
// A Settings card (page = settings, scrolled to the card's id).
function mcCard(label, icon, cardId, area, isDefault) {
    return { label: label, icon: icon, sref: MC_PREFIX + 'settings', states: [MC_PREFIX + 'settings'], area: area || 'admin', params: { card: cardId }, card: cardId, isDefault: !!isDefault };
}
function mcTab(label, icon, pages) { return { label: label, icon: icon, pages: pages }; }

var MC_SMS_STATES = ['sms', 'sms_hazards', 'sms_occurrences', 'sms_risks', 'sms_actions', 'sms_audits', 'sms_documents',
    'sms_meetings', 'sms_change', 'sms_instructors', 'sms_students', 'sms_erp', 'sms_bulletins', 'sms_settings',
    'sms_audit_view'].map(function (s) { return MC_PREFIX + s; });

var MC_AREAS = {
    ops: {
        title: 'Ops', subtitle: 'The front desk — run the day', icon: 'fa-concierge-bell',
        tabs: [
            mcTab('Today', 'fa-plane-departure', [
                mcPage('Booked Out', 'fa-plane-departure', MC_PREFIX + 'flying')
            ]),
            mcTab('Scheduler', 'fa-calendar-alt', [
                mcPage('Bookings', 'fa-calendar-alt', 'dashboard.add_booking', ['dashboard.add_booking'], 'scheduler'),
                mcPage('Instructors', 'fa-user-tie', 'dashboard.manage_instructor_bookings')
            ]),
            mcTab('Flights', 'fa-paper-plane', [
                mcPage('Flights', 'fa-paper-plane', MC_PREFIX + 'flights'),
                mcPage('Split review', 'fa-code-branch', MC_PREFIX + 'split_review')
            ]),
            mcTab('Aircraft', 'fa-plane', [
                mcPage('Fleet', 'fa-plane', MC_PREFIX + 'planes', [MC_PREFIX + 'planes', MC_PREFIX + 'add_plane', MC_PREFIX + 'edit_plane']),
                mcPage('Maintenance', 'fa-wrench', MC_PREFIX + 'maintenance'),
                mcPage('Lubricant receipts', 'fa-receipt', MC_PREFIX + 'receipts'),
                mcPage('Lubricant approval', 'fa-check-circle', MC_PREFIX + 'receipt_approval'),
                mcCard('Daily status report', 'fa-paper-plane', 'daily-aircraft-status'),
                mcPage('Airfield', 'fa-broadcast-tower', MC_PREFIX + 'airfield_bookout', [MC_PREFIX + 'airfield_bookout', MC_PREFIX + 'airfield_hub', MC_PREFIX + 'airfield_bookout_legacy', MC_PREFIX + 'airfield_hub_legacy', MC_PREFIX + 'airfield_index']),
                mcPage('Schedule display', 'fa-tv', MC_PREFIX + 'schedule_display'),
                mcPage('Trackers', 'fa-map-marker-alt', MC_PREFIX + 'trackers', [MC_PREFIX + 'trackers', MC_PREFIX + 'trackers_unit_detail', MC_PREFIX + 'trackers_activity', MC_PREFIX + 'trackers_returns', MC_PREFIX + 'trackers_return_detail'])
            ]),
            mcTab('Members', 'fa-users', [
                mcPage('Members', 'fa-users', MC_PREFIX + 'members', [MC_PREFIX + 'members', MC_PREFIX + 'add_member', MC_PREFIX + 'edit_member', MC_PREFIX + 'import_members', MC_PREFIX + 'member_requests', MC_PREFIX + 'missing_students', MC_PREFIX + 'records_to_file'])
            ]),
            mcTab('Take payment', 'fa-cash-register', [
                mcPage('Invoices', 'fa-file-invoice-dollar', MC_PREFIX + 'invoices', null, 'accounting')
            ]),
            mcTab('Vouchers', 'fa-ticket-alt', [
                mcPage('Vouchers', 'fa-ticket-alt', MC_PREFIX + 'vouchers')
            ]),
            mcTab('Shop', 'fa-store', [
                mcPage('The Shop', 'fa-store', MC_PREFIX + 'the_shop'),
                mcPage('Shop items', 'fa-shopping-cart', MC_PREFIX + 'shop_items', [MC_PREFIX + 'shop_items', MC_PREFIX + 'add_shop_item', MC_PREFIX + 'edit_shop_item'])
            ]),
            mcTab('Documents', 'fa-folder-open', [
                mcPage('Club documents', 'fa-folder-open', MC_PREFIX + 'documents')
            ])
        ]
    },
    accounting: {
        title: 'Accounting', subtitle: 'The money', icon: 'fa-calculator',
        tabs: [
            mcTab('Invoices', 'fa-file-invoice-dollar', [
                mcPage('Invoices', 'fa-file-invoice-dollar', MC_PREFIX + 'invoices')
            ]),
            mcTab('Payments', 'fa-credit-card', [
                mcPage('Payments', 'fa-credit-card', MC_PREFIX + 'payments')
            ]),
            mcTab('Export', 'fa-file-export', [
                mcPage('Accounting export', 'fa-file-export', MC_PREFIX + 'accounting_export'),
                mcCard('Accounting codes', 'fa-hashtag', 'accounting')
            ]),
            mcTab('Fees & rates', 'fa-tags', [
                mcCard('Cancellation fees', 'fa-clock', 'booking-edit-limits'),
                mcPage('Rental items', 'fa-box-open', MC_PREFIX + 'items', [MC_PREFIX + 'items', MC_PREFIX + 'add_item', MC_PREFIX + 'edit_item']),
                mcPage('Packages', 'fa-cube', MC_PREFIX + 'package', null, 'admin'),
                mcPage('Voucher pricing', 'fa-cloud', MC_PREFIX + 'experiences', null, 'admin')
            ]),
            mcTab('Payouts', 'fa-university', [
                mcCard('Stripe Connect', 'fa-university', 'payment-integrations', 'super_admin')
            ]),
            mcTab('Reports', 'fa-chart-bar', [
                mcPage('Statistics', 'fa-chart-bar', MC_PREFIX + 'club_stats'),
                mcPage('Voucher sales', 'fa-ticket-alt', MC_PREFIX + 'vouchers', null, 'ops'),
                mcPage('Tracker billing', 'fa-map-marker-alt', MC_PREFIX + 'trackers_billing', [MC_PREFIX + 'trackers_billing', MC_PREFIX + 'trackers_dd_confirm', MC_PREFIX + 'trackers_shop', MC_PREFIX + 'trackers_orders', MC_PREFIX + 'trackers_order_detail'])
            ])
        ]
    },
    admin: {
        title: 'Admin', subtitle: 'Configure and run the club', icon: 'fa-sliders-h',
        tabs: [
            mcTab('Memberships', 'fa-id-card', [
                mcPage('Membership types', 'fa-id-card', MC_PREFIX + 'memberships', [MC_PREFIX + 'memberships', MC_PREFIX + 'add_membership', MC_PREFIX + 'edit_membership']),
                mcCard('Renewals', 'fa-sync-alt', 'membership-renewals'),
                mcCard('T&Cs & privacy', 'fa-file-contract', 'membership-terms')
            ]),
            mcTab('Training', 'fa-chalkboard-teacher', [
                mcPage('Courses', 'fa-chalkboard-teacher', MC_PREFIX + 'courses', [MC_PREFIX + 'courses', MC_PREFIX + 'add_course', MC_PREFIX + 'edit_course', MC_PREFIX + 'add_lesson', MC_PREFIX + 'edit_lesson', MC_PREFIX + 'course_content', MC_PREFIX + 'questionnaire_builder', MC_PREFIX + 'questionnaire_attempts', MC_PREFIX + 'questionnaire_review', MC_PREFIX + 'material_access']),
                mcPage('Exam results', 'fa-file-signature', MC_PREFIX + 'exam_results'),
                mcPage('Packages', 'fa-cube', MC_PREFIX + 'package', [MC_PREFIX + 'package', MC_PREFIX + 'add_package', MC_PREFIX + 'edit_package']),
                mcPage('Data import', 'fa-file-import', MC_PREFIX + 'data_import', [MC_PREFIX + 'data_import', MC_PREFIX + 'tpc_import_run']),
                mcPage('Records to file', 'fa-file-signature', MC_PREFIX + 'records_to_file', null, 'ops'),
                mcPage('Missing students', 'fa-user-times', MC_PREFIX + 'missing_students', null, 'ops')
            ]),
            mcTab('Instructors', 'fa-user-tie', [
                mcPage('Instructor charges', 'fa-pound-sign', MC_PREFIX + 'instructor_charges'),
                mcPage('Instructor settings', 'fa-user-tie', 'dashboard.manage_instructor_bookings', null, 'ops')
            ]),
            mcTab('Vouchers setup', 'fa-ticket-alt', [
                mcPage('Air Experiences', 'fa-cloud', MC_PREFIX + 'experiences'),
                mcPage('Discounts', 'fa-percentage', MC_PREFIX + 'experience_discounts'),
                mcPage('Website widget', 'fa-code', MC_PREFIX + 'voucher_widget')
            ]),
            mcTab('Booking rules', 'fa-calendar-check', [
                mcCard('Booking settings', 'fa-calendar-check', 'booking-settings', 'admin', true),
                mcCard('Flight times display', 'fa-stopwatch', 'flight-times'),
                mcCard('Edit time limits', 'fa-clock', 'booking-edit-limits'),
                mcPage('Booking slots', 'fa-th', MC_PREFIX + 'booking_slots')
            ]),
            mcTab('Aircraft rules', 'fa-clipboard-check', [
                mcCard('Aircraft check types', 'fa-clipboard-check', 'aircraft-check-types')
            ]),
            mcTab('Comms', 'fa-envelope-open-text', [
                mcPage('Reminders', 'fa-bell', MC_PREFIX + 'reminders'),
                mcPage('Email log', 'fa-envelope-open-text', MC_PREFIX + 'email_log'),
                mcCard('Daily report recipients', 'fa-paper-plane', 'daily-aircraft-status')
            ]),
            mcTab('Safety', 'fa-shield-alt', [
                mcPage('Safety (SMS)', 'fa-shield-alt', MC_PREFIX + 'sms', MC_SMS_STATES)
            ]),
            mcTab('Automations', 'fa-robot', [
                mcPage('Automations', 'fa-robot', MC_PREFIX + 'automations')
            ])
        ]
    },
    super_admin: {
        title: 'Super-admin', subtitle: 'The keys — club details and integrations', icon: 'fa-key',
        tabs: [
            mcTab('Club details', 'fa-building', [
                mcCard('Company details', 'fa-building', 'company-details'),
                mcCard('Invoice details', 'fa-file-invoice', 'invoice-details')
            ]),
            mcTab('Integrations', 'fa-plug', [
                mcPage('BookedScheduler sync', 'fa-sync-alt', MC_PREFIX + 'bs_sync', [MC_PREFIX + 'bs_sync', MC_PREFIX + 'stripe_rtn', MC_PREFIX + 'stripe_refresh']),
                mcCard('Stripe Connect & payment mode', 'fa-university', 'payment-integrations'),
                mcPage('AirfieldHub (PPR)', 'fa-route', MC_PREFIX + 'airfield_hub', null, 'ops')
            ])
        ]
    }
};
// The home page tiles (views/manage_club.html) repeat these tabs statically
// (that page has no controller by design) — keep the two lists in step.
// (file-level since 10 Nov: ManageClubHomeController reads it before any hub exists)

AreaHubController.AREAS = MC_AREAS;

app.controller('AreaHubController', AreaHubController);
AreaHubController.$inject = ['$rootScope', '$scope', '$state', '$location', '$timeout', '$anchorScroll'];
function AreaHubController($rootScope, $scope, $state, $location, $timeout, $anchorScroll) {
    var hub = this;
    var MC = MC_PREFIX;

    // The page's HOME area comes from its state data (set on the abstract hub
    // state; children inherit it, so $state.current.data.area is the same).
    function pageArea() {
        var d = $state.$current && $state.$current.data;
        for (var st = $state.$current; st; st = st.parent) {
            if (st.self && st.self.abstract && st.self.data && st.self.data.area) { return st.self.data.area; }
        }
        return (d && d.area) || 'ops';
    }
    // The chrome follows the area the person ENTERED, not the page's home
    // (owner, 10 Nov 2026): Ops → Take payment opens Accounting's Invoices page,
    // but the bar stays Ops with "Take payment" active, and the same for every
    // page two areas share. The entered area is remembered for the browser
    // session (a tile click on views/manage_club.html — directive mcAreaTile —
    // or the hub the person was last in); a deep link, or a page the remembered
    // area doesn't list, falls back to the page's own area.
    var rememberedArea = mcRememberedArea, rememberArea = mcRememberArea;
    // Does this area list the page we are on (a tab's page, or a Settings card)?
    function areaLists(area) {
        var A = MC_AREAS[area];
        if (!A) { return false; }
        for (var i = 0; i < A.tabs.length; i++) {
            for (var j = 0; j < A.tabs[i].pages.length; j++) { if (hub.isActivePage(A.tabs[i].pages[j])) { return true; } }
        }
        return false;
    }
    function applyArea() {
        var own = pageArea();
        var mem = rememberedArea();
        hub.area = (mem && mem !== own && areaLists(mem)) ? mem : own;
        rememberArea(hub.area);
        $rootScope.mcArea = hub.area;   // for views whose own controller is also `hub` (members_hub.html)
        hub.meta = MC_AREAS[hub.area] || MC_AREAS.ops;
        hub.tabs = hub.meta.tabs;
    }
    hub.state = $state;
    // Which area's sub-nav a shared page should show (the _*_nav.html includes):
    // true when this hub is one of the areas given.
    hub.inArea = function () {
        for (var i = 0; i < arguments.length; i++) { if (arguments[i] === hub.area) { return true; } }
        return false;
    };

    // Hide the chrome for the non-admin exceptions (an instructor marking a
    // questionnaire, an SMS post holder): "Back to Manage Club" would only toast
    // at them (the guard in app.js). Same rule as the menu's show_manager.
    hub.showChrome = function () {
        var u = $rootScope.globals && $rootScope.globals.currentUser;
        var a = u && u.access;
        if ($rootScope.isToAviateStaff && $rootScope.isToAviateStaff()) { return true; }
        return !!(a && ((angular.isArray(a.manager) && a.manager.length) || (angular.isArray(a.super_admin) && a.super_admin.length)));
    };

    function cardParam() { return ($location.search() || {}).card || null; }

    hub.href = function (p) {
        try { return $state.href(p.sref, p.params || {}); } catch (e) { return ''; }
    };
    hub.isActivePage = function (p) {
        if (p.card) {
            if (!$state.includes(MC + 'settings')) { return false; }
            var c = cardParam();
            return c ? c === p.card : !!p.isDefault;
        }
        for (var i = 0; i < p.states.length; i++) {
            if ($state.includes(p.states[i])) { return true; }
        }
        return false;
    };
    hub.isActiveTab = function (t) {
        for (var i = 0; i < t.pages.length; i++) { if (hub.isActivePage(t.pages[i])) { return true; } }
        return false;
    };
    hub.activeTab = function () {
        for (var i = 0; i < hub.tabs.length; i++) { if (hub.isActiveTab(hub.tabs[i])) { return hub.tabs[i]; } }
        return null;
    };
    // The page row shows only when the active tab has more than one page.
    hub.pages = function () {
        var t = hub.activeTab();
        return (t && t.pages.length > 1) ? t.pages : [];
    };
    hub.tabHref = function (t) { return hub.href(t.pages[0]); };
    // No page is "another area's" any more: the chrome follows the entered area
    // (applyArea), so a shared page simply renders under this hub. Kept for
    // any template still calling it.
    hub.crossArea = function () { return null; };

    applyArea();
    // A child page change within the same hub: the remembered area may no
    // longer list the new page (a link inside a page) — re-apply.
    $scope.$on('$stateChangeSuccess', applyArea);

    // Settings card deep link: scroll to the card once the page is in.
    function scrollToCard() {
        var c = cardParam();
        if (!c || !$state.includes(MC + 'settings')) { return; }
        $timeout(function () {
            var el = document.getElementById(c);
            if (el && el.scrollIntoView) {
                el.scrollIntoView({ block: 'start', behavior: 'auto' });
                if (window.scrollBy) { window.scrollBy(0, -96); }   // clear the fixed app header
            } else {
                $anchorScroll(c);
            }
        }, 450);
    }
    $scope.$on('$locationChangeSuccess', scrollToCard);
    scrollToCard();
}

// The Manage Club home tiles (views/manage_club.html): a click anywhere on a
// tile (its head or one of its tabs) records that area as the one entered, so
// the hub the target page opens in shows THIS area's bar and tabs. The Safety
// tile records Admin (its pages live under Admin → Safety).
app.directive('mcAreaTile', function () {
    return {
        restrict: 'A',
        link: function (scope, el, attrs) {
            el.on('click', function () { mcRememberArea(attrs.mcAreaTile); });
        }
    };
});

// Manage Club HOME (views/manage_club.html): "Grouped view" (the area tiles) or
// "Flat view" — every page in one list with a filter box, to go anywhere fast
// (owner, 10 Nov 2026). The flat list is AREAS flattened (one entry per page,
// the first area that lists it wins) plus the Safety tile's own screens, so it
// can never drift from the hubs. The chosen view is kept per browser
// (localStorage ta_mc_home_view). Enter opens the first match. Opening a page
// records its area (mcRememberArea), so the hub shows that area's bar.
app.controller('ManageClubHomeController', ManageClubHomeController);
ManageClubHomeController.$inject = ['$state', '$timeout'];
function ManageClubHomeController($state, $timeout) {
    var home = this;
    var VIEW_KEY = 'ta_mc_home_view';
    var SAFETY = [   // the Safety tile's screens (Admin → Safety holds the one "Safety (SMS)" page)
        { label: 'Safety dashboard', icon: 'fa-tachometer-alt', sref: 'dashboard.manage_club.sms' },
        { label: 'Hazards', icon: 'fa-exclamation-triangle', sref: 'dashboard.manage_club.sms_hazards' },
        { label: 'Occurrences', icon: 'fa-bolt', sref: 'dashboard.manage_club.sms_occurrences' },
        { label: 'Safety settings', icon: 'fa-cog', sref: 'dashboard.manage_club.sms_settings' }
    ];

    // the Flat (list / search) view is the default (owner, 10 Nov 2026); a Grouped choice is remembered per browser
    function readView() { try { return localStorage.getItem(VIEW_KEY) === 'grouped' ? 'grouped' : 'flat'; } catch (e) { return 'flat'; } }
    home.view = readView();
    // the search box takes focus on a desktop when the page opens in the Flat view (phones keep the keyboard down)
    if (home.view === 'flat') { $timeout(function () { var el = document.getElementById('mchome-q'); if (el && window.innerWidth > 768) { el.focus(); } }, 0); }
    home.setView = function (v) {
        home.view = (v === 'flat') ? 'flat' : 'grouped';
        try { localStorage.setItem(VIEW_KEY, home.view); } catch (e) { /* private mode */ }
        if (home.view === 'flat') { $timeout(function () { var el = document.getElementById('mchome-q'); if (el && window.innerWidth > 768) { el.focus(); } }, 0); }
    };
    home.q = '';

    // every page, once
    var pages = [], seen = {};
    function add(area, areaTitle, tab, p) {
        var key = p.sref + '|' + (p.card || '');
        if (seen[key]) { return; }
        seen[key] = true;
        pages.push({ label: p.label, icon: p.icon, sref: p.sref, params: p.params || null, area: area, areaTitle: areaTitle, tab: tab,
            hay: (p.label + ' ' + tab + ' ' + areaTitle).toLowerCase() });
    }
    angular.forEach(['ops', 'accounting', 'admin', 'super_admin'], function (area) {
        var A = MC_AREAS[area];
        angular.forEach(A.tabs, function (t) { angular.forEach(t.pages, function (p) { add(area, A.title, t.label, p); }); });
    });
    angular.forEach(SAFETY, function (p) { add('admin', 'Admin', 'Safety', p); });
    home.pages = pages;
    home.areaOrder = ['ops', 'accounting', 'admin', 'super_admin'];
    home.areaTitle = function (a) { return MC_AREAS[a] ? MC_AREAS[a].title : a; };
    home.areaIcon = function (a) { return MC_AREAS[a] ? MC_AREAS[a].icon : 'fa-folder'; };

    // the filter: every word typed must appear in label / tab / area; best matches first
    function tokens() { return home.q.toLowerCase().split(/\s+/).filter(function (t) { return t; }); }
    function rank(p, toks) {
        var l = p.label.toLowerCase();
        if (l.indexOf(toks[0]) === 0) { return 0; }
        if (l.indexOf(toks[0]) > -1) { return 1; }
        return 2;
    }
    home.matches = function () {
        var toks = tokens();
        if (toks.length === 0) { return pages; }
        var out = pages.filter(function (p) {
            for (var i = 0; i < toks.length; i++) { if (p.hay.indexOf(toks[i]) === -1) { return false; } }
            return true;
        });
        out.sort(function (a, b) { return rank(a, toks) - rank(b, toks); });
        return out;
    };
    home.hasQuery = function () { return tokens().length > 0; };
    home.inArea = function (area) { return pages.filter(function (p) { return p.area === area; }); };
    home.href = function (p) { try { return $state.href(p.sref, p.params || {}); } catch (e) { return ''; } };
    home.open = function (p) { mcRememberArea(p.area); };
    home.enter = function () {
        var m = home.matches();
        if (home.hasQuery() && m.length > 0) { home.open(m[0]); $state.go(m[0].sref, m[0].params || {}); }
    };
    home.clear = function () { home.q = ''; };
}
