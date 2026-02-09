var app = angular
	        .module('app', ['flow', 'ui.router', 'ngCookies', 'ngTouch', 'angularInlineEdit', 'ngTagsInput', 'iso.directives', 'dndLists', 'ngAnimate', 'ngSanitize', 'ui.select', 'ui.bootstrap', 'ui.calendar', 'rgkevin.datetimeRangePicker', 'betsol.intlTelInput', 'credit-cards', 'toggle-switch'])
	        .config(config)
	        .run(run);

    // =============================================
    // HTTP INTERCEPTOR: Prefixes API calls with the
    // correct base URL from EnvConfig, so every
    // $http call to /api/... or api/... automatically
    // hits the right server per environment.
    // =============================================
    app.factory('apiUrlInterceptor', ['EnvConfig', function(EnvConfig) {
        return {
            request: function(config) {
                var url = config.url;

                // Normalise: treat 'api/v1/...' the same as '/api/v1/...'
                if (url.indexOf('api/') === 0) {
                    url = '/' + url;
                    config.url = url;
                }

                // Only prefix requests that start with /api/
                if (url.indexOf('/api/') === 0) {
                    config.url = EnvConfig.getApiBaseUrl() + url;
                }

                return config;
            }
        };
    }]);

    app.config(['$httpProvider', function($httpProvider) {
        $httpProvider.interceptors.push('apiUrlInterceptor');
    }]);

    // Start all datepickers on Monday
    app.config(['uibDatepickerConfig', function(uibDatepickerConfig) {
        uibDatepickerConfig.startingDay = 1;
    }]);
 
    app.filter('yesNo', function () {
        return function (boolean) {
            return boolean ? 'Yes' : 'No';
        }
    });


 	//ROUTES
    config.$inject = ['flowFactoryProvider', '$stateProvider', '$urlRouterProvider', '$locationProvider', 'intlTelInputOptions', '$windowProvider'];
    function config(flowFactoryProvider, $stateProvider, $urlRouterProvider, $locationProvider, intlTelInputOptions, $windowProvider) {

    	// console.log("CONFIG");

        var $window = $windowProvider.$get();
        //$window.Stripe.setPublishableKey('pk_test_Vlf9V6WIIyjrBiJKVEfETqW8');

        //StripeProvider.setPublishableKey('pk_test_Ers4ZfdIMZ59ac4wKy6FDAH2');

        //phone number
         angular.extend(intlTelInputOptions, {
              // nationalMode: false,
              utilsScript: '/libs/js/phone_utils.js',
              // defaultCountry: 'auto',
              preferredCountries: ['gb'],
              autoFormat: true,
              autoPlaceholder: "polite"
            });


        $locationProvider.html5Mode(true); 

    	flowFactoryProvider.defaults = {
		    target: 'upload.php',
		    permanentErrors: [404, 500, 501],
		    maxChunkRetries: 1,
		    chunkRetryInterval: 5000,
		    simultaneousUploads: 4,
            chunkSize: 1024*1024*1024,
            progressCallbacksInterval: 500,
            simultaneousUploads: 1,
            testChunks: true
		  };

		  flowFactoryProvider.on('catchAll', function (event) {
		    console.log('catchAll', arguments);
		  });


        $stateProvider
            .state('login', {
                url: '/login',
                templateUrl: 'views/login.html',
                controller: 'LoginController',
                controllerAs: 'vm'
            })



            .state('password_reset', {
                url: '/password_reset',
                templateUrl: 'views/password_reset.html',
                controller: 'PasswordResetController',
                controllerAs: 'vm'
            })

            .state('password_reset2', {
                url: '/password_reset/:token',
                templateUrl: 'views/password_reset2.html',
                controller: 'PasswordResetController',
                controllerAs: 'vm'
            })



            .state('users', {
                url: '/users',
                controller: 'HomeController',
                templateUrl: 'views/list_users.html',
                controllerAs: 'vm'
            })

            .state('users.details', {
                url: '/users/:userId',
                controller: 'UsersController',
                templateUrl: 'views/edit_user.html',
                controllerAs: 'vm'
            })
 
            .state('register', {
                url: '/register',
                controller: 'RegisterController',
                templateUrl: 'views/register.html',
                controllerAs: 'vm'
            })



            .state('registration_success', {
                url: '/registration_success',
                controller: 'RegisterController',
                templateUrl: 'views/registration_success.html',
                controllerAs: 'vm'
            })

            .state('registration_verification', {
                url: '/registration_verification/:userId/:token',
                controller: 'RegisterController',
                templateUrl: 'views/registration_verification.html',
                controllerAs: 'vm'
            })

            .state('dashboard', {
                url: '/dashboard',
                controller: 'DashboardController',
                templateUrl: 'views/dashboard.html',
                controllerAs: 'vm'
            })





        // THIS IS THE CLUB DASHBOARD BIT :)

            //dashboardClubInstructorBookings
            .state('dashboard.manage_instructor_bookings', {
                url: '/manage_instructor_bookings',
                controller: 'DashboardClubInstructorBookings',
                templateUrl: 'views/manageclub/instructor_bookings.html',
                controllerAs: 'vm',
                data: {
                    action: "list"
                }
            })


            .state('dashboard.manage_club', {
                url: '/manage_club',
                controller: 'DashboardController',
                templateUrl: 'views/manage_club.html',
                controllerAs: 'vm'
            })


            // FLYING INCOMPLETE

            .state('dashboard.manage_club.flying', {
                url: '/flying',
                controller: 'DashboardClubFlyingController',
                templateUrl: 'views/manageclub/flying.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            // ALL FLIGHTS
            
            .state('dashboard.manage_club.flights', {
                url: '/flights',
                controller: 'DashboardClubFlightsController',
                templateUrl: 'views/manageclub/flights.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            // CLUB ITEMS

            .state('dashboard.manage_club.receipts', {
                url: '/receipts',
                controller: 'DashboardClubReceiptsController',
                templateUrl: 'views/manageclub/receipts.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })


            .state('dashboard.manage_club.receipt_approval', {
                url: '/receipt_approval',
                controller: 'DashboardClubReceiptsApprovalController',
                templateUrl: 'views/manageclub/receipt_approval.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })


            // CLUB ITEMS

            .state('dashboard.manage_club.items', {
                url: '/items',
                controller: 'DashboardClubItemsController',
                templateUrl: 'views/manageclub/items.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_club.add_item', {
                url: '/add_items',
                controller: 'DashboardClubItemsController',
                templateUrl: 'views/manageclub/item_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'add'
                }
            })

            .state('dashboard.manage_club.edit_item', {
                url: '/edit_items/:item_id',
                controller: 'DashboardClubItemsController',
                templateUrl: 'views/manageclub/item_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
            })


            // CLUB SHOP ITEMS

            .state('dashboard.manage_club.shop_items', {
                url: '/shop',
                controller: 'DashboardClubShopItemsController',
                templateUrl: 'views/manageclub/shop_items.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_club.add_shop_item', {
                url: '/add_shop_item',
                controller: 'DashboardClubShopItemsController',
                templateUrl: 'views/manageclub/shop_item_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'add'
                }
            })

            .state('dashboard.manage_club.edit_shop_item', {
                url: '/edit_shop_items/:item_id',
                controller: 'DashboardClubShopItemsController',
                templateUrl: 'views/manageclub/shop_item_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
            })

            .state('dashboard.manage_club.the_shop', {
                url: '/the_shop',
                controller: 'DashboardClubShopSaleController',
                templateUrl: 'views/manageclub/the_shop.html',
                controllerAs: 'vm'
            })


            


            // INSTRUCTOR CHARGES

            .state('dashboard.manage_club.instructor_charges', {
                url: '/instructor_charges',
                controller: 'DashboardClubInstructorChargesController',
                templateUrl: 'views/manageclub/instructor_charges.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_club.instructor_charges.add', {
                url: '/add',
                controller: 'DashboardClubInstructorChargesController',
                templateUrl: 'views/manageclub/instructor_charges_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'add'
                }
            })

            .state('dashboard.manage_club.instructor_charges.edit', {
                url: '/edit/:id',
                controller: 'DashboardClubInstructorChargesController',
                templateUrl: 'views/manageclub/instructor_charges_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
            })



            // EXPERIENCES AVAILABLE

            .state('dashboard.manage_club.experiences', {
                url: '/experiences',
                controller: 'DashboardClubExperiencesController',
                templateUrl: 'views/manageclub/experiences.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_club.experiences.add', {
                url: '/add',
                controller: 'DashboardClubExperiencesController',
                templateUrl: 'views/manageclub/experiences_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'add'
                }
            })

            .state('dashboard.manage_club.experiences.edit', {
                url: '/edit/:id',
                controller: 'DashboardClubExperiencesController',
                templateUrl: 'views/manageclub/experiences_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
            })

            // EXPERIENCES AVAILABLE

            .state('dashboard.manage_club.experience_discounts', {
                url: '/experience_discounts',
                controller: 'DashboardClubExperienceDiscountsController',
                templateUrl: 'views/manageclub/experience_discounts.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_club.experience_discounts.add', {
                url: '/add',
                controller: 'DashboardClubExperienceDiscountsController',
                templateUrl: 'views/manageclub/experience_discounts_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'add'
                }
            })

            .state('dashboard.manage_club.experience_discounts.edit', {
                url: '/edit/:id',
                controller: 'DashboardClubExperienceDiscountsController',
                templateUrl: 'views/manageclub/experience_discounts_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
            })


            // VOUCHERS

            .state('dashboard.manage_club.vouchers', {
                url: '/vouchers',
                controller: 'DashboardClubVouchersController',
                templateUrl: 'views/manageclub/vouchers.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_club.vouchers.add', {
                url: '/add',
                controller: 'DashboardClubVouchersAddController',
                templateUrl: 'views/manageclub/voucher_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'add'
                }
            })

            .state('dashboard.manage_club.vouchers.edit', {
                url: '/edit/:id',
                controller: 'DashboardClubVouchersEditController',
                templateUrl: 'views/manageclub/voucher_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
            })




            //CLUB DOCUMENTS

            .state('dashboard.manage_club.documents', {
            url: '/documents',
            templateUrl: 'views/manageclub/documents.html',
            controller: 'ClubDocumentsController',
            controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_club.documents.edit', {
                url: '/documents/:document_id',
                templateUrl: 'views/manageclub/document_form.html',
                controller: 'ClubDocumentsController',
                controllerAs: 'vm',
                    data: {
                        action: 'edit'
                    }
            })

            .state('dashboard.manage_club.documents.add', {
                url: '/add',
                templateUrl: 'views/manageclub/document_form.html',
                controller: 'ClubDocumentsController',
                controllerAs: 'vm',
                    data: {
                        action: 'add'
                    }
            })





            // PLANES

            .state('dashboard.manage_club.planes', {
                url: '/planes',
                controller: 'DashboardClubPlanesController',
                templateUrl: 'views/manageclub/planes.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_club.add_plane', {
                url: '/add_plane',
                controller: 'DashboardClubPlanesController',
                templateUrl: 'views/manageclub/plane_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'add'
                }
            })

            .state('dashboard.manage_club.edit_plane', {
                url: '/edit_plane/:plane_id',
                controller: 'DashboardClubPlanesController',
                templateUrl: 'views/manageclub/plane_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
            })



            // COURSES

            .state('dashboard.manage_club.courses', {
                url: '/courses',
                controller: 'DashboardClubCourseController',
                templateUrl: 'views/manageclub/courses.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_club.add_course', {
                url: '/add_course',
                controller: 'DashboardClubCourseController',
                templateUrl: 'views/manageclub/course_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'add'
                }
            })

            .state('dashboard.manage_club.edit_course', {
                url: '/edit_course/:course_id',
                controller: 'DashboardClubCourseController',
                templateUrl: 'views/manageclub/course_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
            })

            .state('dashboard.manage_club.add_lesson', {
                url: '/edit_course/:course_id/add_lesson',
                controller: 'DashboardClubLessonController',
                templateUrl: 'views/manageclub/lesson_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'add'
                }
            })

            .state('dashboard.manage_club.edit_lesson', {
                url: '/edit_course/:course_id/edit_lesson/:lesson_id',
                controller: 'DashboardClubLessonController',
                templateUrl: 'views/manageclub/lesson_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
            })


            // SYLLABUSES / SYLLABI ? no idea...

            .state('dashboard.my_account.syllabus', {
                url: '/syllabus',
                controller: 'DashboardCourseSyllabusController',
                templateUrl: 'views/my_account/courses.html',
                controllerAs: 'vm',
                data: {
                    action: 'list_member'
                }
            })

            .state('dashboard.my_account.syllabus_view_course', {
                url: '/syllabus/:course_id',
                controller: 'DashboardCourseSyllabusViewController',
                templateUrl: 'views/my_account/course.html',
                controllerAs: 'vm',
                data: {
                    action: 'view'
                }
            })

            .state('dashboard.my_account.syllabus_view_lesson', {
                url: '/syllabus/course/:course_id/lesson/:lesson_id',
                templateUrl: 'views/my_account/lesson.html',
                controller: 'DashboardCourseSyllabusViewController',
                controllerAs: 'vm',
                data: {
                    action: 'view_lesson'
                }
            })



            // BRIEFING & DEBRIEFINGS...

            .state('dashboard.manage_user.briefing', {
                url: '/briefing',
                controller: 'DashboardInstructorBriefController',
                templateUrl: 'views/manageuser/briefing.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_user.briefing_lesson', {
                url: '/briefing/:booking_id/lesson/:lesson_id',
                controller: 'DashboardInstructorBriefController',
                templateUrl: 'views/manageuser/briefing_lesson.html',
                controllerAs: 'vm',
                data: {
                    action: 'view_lesson'
                }
            })

            .state('dashboard.manage_user.debriefing', {
                url: '/debriefing/:booking_id/:plane_log_sheet_id/:split_next_id/:split_booking_id',
                controller: 'DashboardInstructorBriefController',
                templateUrl: 'views/manageuser/debriefing.html',
                controllerAs: 'vm',
                data: {
                    action: 'debrief'
                },
                params: {
                    booking_id: null,
                    split_next_id: null,
                    split_booking_id: null,
                    plane_log_sheet_id: null
                }
            })

            .state('dashboard.manage_user.debriefing_list', {
                url: '/debriefing_list',
                controller: 'DashboardInstructorBriefController',
                templateUrl: 'views/manageuser/debriefing_list.html',
                controllerAs: 'vm',
                data: {
                    action: 'debrief_list'
                }
            })

            .state('dashboard.manage_user.student_records', {
                url: '/student_records',
                controller: 'DashboardStudentRecordsController',
                templateUrl: 'views/manageuser/student_records.html',
                controllerAs: 'vm',
                data: {
                    action: 'student_records'
                }
            })

            .state('dashboard.my_account.training_records', {
                url: '/training_records',
                controller: 'DashboardStudentRecordsController',
                templateUrl: 'views/my_account/student_record.html',
                controllerAs: 'vm',
                data: {
                    action: 'student_record'
                }
            })




            // PACKAGES
            .state('dashboard.manage_club.package', {
                url: '/packages',
                controller: 'DashboardClubPackagesController',
                templateUrl: 'views/manageclub/packages.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_club.add_package', {
                url: '/add_package',
                controller: 'DashboardClubPackagesController',
                templateUrl: 'views/manageclub/packages_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'add'
                }
            })

            .state('dashboard.manage_club.edit_package', {
                url: '/edit_package/:package_id',
                controller: 'DashboardClubPackagesController',
                templateUrl: 'views/manageclub/packages_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
            })

            

            // MAINTENANCE

            .state('dashboard.manage_club.maintenance', {
                url: '/maintenance',
                controller: 'DashboardClubMaintenanceController',
                templateUrl: 'views/manageclub/maintenance.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

             .state('dashboard.manage_club.maintenance.add_maintenance', {
                url: '/add',
                controller: 'DashboardClubMaintenanceController',
                templateUrl: 'views/manageclub/add_maintenance.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_club.maintenance.detail', {
                url: '/plane/:plane_id',
                controller: 'DashboardClubMaintenanceController',
                templateUrl: 'views/manageclub/maintenance_detail.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
            })


            .state('dashboard.manage_club.maintenance.detail.engine_logbook', {
                url: '/engine_logbook/:engine_id',
                controller: 'DashboardClubEngineLogbookController',
                templateUrl: 'views/manageclub/engine_logbook.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            

            .state('dashboard.manage_club.maintenance.detail.airframe_logbook', {
                url: '/airframe_logbook',
                controller: 'DashboardClubAirframeLogbookController',
                templateUrl: 'views/manageclub/airframe_logbook.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })


            .state('dashboard.manage_club.maintenance.detail.propeller_logbook', {
                url: '/propeller_logbook/:prop_id',
                controller: 'DashboardClubPropellerLogbookController',
                templateUrl: 'views/manageclub/propeller_logbook.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })



            .state('dashboard.manage_club.maintenance.review', {
                url: '/review/:review_id',
                controller: 'DashboardClubMaintenanceController',
                templateUrl: 'views/manageclub/maintenance_review.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })






            //PAYMENTS & REFUNDS


            .state('dashboard.manage_club.payments', {
                url: '/payments',
                controller: 'DashboardClubPaymentsController',
                templateUrl: 'views/manageclub/payments.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })


            //ALL INVOICES
            .state('dashboard.manage_club.invoices', {
                url: '/invoices',
                templateUrl: 'views/manageclub/all_invoices.html',
                controller: 'DashboardClubInvoicesController',
                controllerAs: 'vm'
            })

            // .state('dashboard.manage_club.edit_payments', {
            //     url: '/edit_payments/:payment_id',
            //     controller: 'DashboardClubPaymentsController',
            //     templateUrl: 'views/manageclub/payments.html',
            //     controllerAs: 'vm',
            //     data: {
            //         action: 'edit'
            //     }
            // })





            // CLUB SETTINGS

            .state('dashboard.manage_club.settings', {
                url: '/settings',
                controller: 'DashboardClubSettingsController',
                templateUrl: 'views/manageclub/settings.html',
                controllerAs: 'vm',
                data: {
                    action: "list"
                }
            })

            // CLUB PAYMENTS TO:::
            .state('dashboard.manage_club.payments_to', {
                url: '/bank_settings',
                controller: 'ClubPaymentsController',
                templateUrl: 'views/manageclub/payment_to.html',
                controllerAs: 'vm'
            })

            .state('dashboard.manage_club.stripe_rtn', {
                url: '/settings/stripe_return/:stripe_id',
                controller: 'DashboardClubSettingsController',
                templateUrl: 'views/manageclub/settings_strip_return.html',
                controllerAs: 'vm',
                data: {
                    action: "stripe_return"
                }
            })

            .state('dashboard.manage_club.stripe_refresh', {
                url: '/settings/stripe_refresh/:stripe_id',
                controller: 'DashboardClubSettingsController',
                templateUrl: 'views/manageclub/settings_strip_refresh.html',
                controllerAs: 'vm',
                data: {
                    action: "stripe_refresh"
                }
            })

            ///manage_club/settings/stripe_return/%s



            // MEMBERSHIPS

            .state('dashboard.manage_club.memberships', {
                url: '/memberships',
                controller: 'DashboardClubMembershipsController',
                templateUrl: 'views/manageclub/memberships.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_club.add_membership', {
                url: '/add_membership',
                controller: 'DashboardClubMembershipsController',
                templateUrl: 'views/manageclub/membership_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'add'
                }
            })

            .state('dashboard.manage_club.edit_membership', {
                url: '/edit_membership/:membership_id',
                controller: 'DashboardClubMembershipsController',
                templateUrl: 'views/manageclub/membership_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
            })


            // MEMBERS 

            .state('dashboard.manage_club.members', {
                url: '/members',
                controller: 'DashboardClubMembersController',
                templateUrl: 'views/manageclub/members.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_club.add_member', {
                url: '/add_member',
                controller: 'DashboardClubMembersController',
                templateUrl: 'views/manageclub/member_invite.html',
                controllerAs: 'vm',
                data: {
                    action: 'add'
                }
            })

            .state('dashboard.manage_club.import_members', {
                url: '/import_members',
                controller: 'DashboardClubMembersController',
                templateUrl: 'views/manageclub/member_import.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })



            .state('dashboard.manage_club.edit_member', {
                url: '/edit_member/:member_id',
                controller: 'DashboardClubMembersController',
                templateUrl: 'views/manageclub/member_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
            })


            .state('dashboard.manage_club.edit_member.check_documents', {
                url: '/check_documents/:document_type',
                controller: 'DashboardClubMembersDocumentController',
                templateUrl: 'views/manageclub/member_documents.html',
                controllerAs: 'vm',
                data: {
                    action: 'checks'
                }
            })



            .state('dashboard.manage_club.member_requests', {
                url: '/member_requests',
                controller: 'DashboardClubMemberRequestsController',
                templateUrl: 'views/manageclub/member_requests.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })





            // THIS IS THE USER DASHBOARD BIT :)

            .state('dashboard.manage_user', {
                url: '/manage_user',
                controller: 'DashboardController',
                templateUrl: 'views/manage_user.html',
                controllerAs: 'vm'
            })

            //MY SCHEDULE
            .state('dashboard.manage_user.my_schedule', {
                url: '/instructor/my_schedule',
                controller: 'ReviewBookingsController',
                templateUrl: 'views/manageuser/my_schedule.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })


            // PLANES

            .state('dashboard.manage_user.instructor_availability', {
                url: '/instructor/availability',
                controller: 'DashboardUserInstructorController',
                templateUrl: 'views/manageuser/instructor_availability.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })
            

            .state('dashboard.manage_user.instructor_holidays', {
                url: '/instructor/holidays',
                controller: 'DashboardUserInstructorHolidayController',
                templateUrl: 'views/manageuser/instructor_holidays.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })


            .state('dashboard.manage_user.instructor_holidays_form', {
                url: '/instructor/holidays/add',
                controller: 'DashboardUserInstructorHolidayController',
                templateUrl: 'views/manageuser/instructor_holidays_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })


            .state('dashboard.bookings', {
                url: '/bookings',
                controller: 'BookingsController',
                templateUrl: 'views/bookings.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                },
                params: {
                    plane_id: null,
                    start: null,
                    duration: null
                }
            })

            .state('dashboard.bookings.add', {
                url: '/add',
                controller: 'BookingsController',
                templateUrl: 'views/bookings/make_booking.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                },
                params: {
                    plane_id: null,
                    start: null,
                    duration: null
                }
            })





            .state('dashboard.add_booking', {
                url: '/add_booking',
                controller: 'Bookings2Controller',
                templateUrl: 'views/bookings/new_add_booking.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                },
                params: {
                    plane_id: null,
                    start: null,
                    duration: null
                }
            })


            .state('dashboard.edit_booking', {
                url: '/edit_booking/:booking_id',
                controller: 'Bookings2Controller',
                templateUrl: 'views/bookings/new_edit_booking.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit',
                    return_to: 'bookings'
                },
                params: {
                    plane_id: null,
                    start: null,
                    duration: null
                }
            })






            .state('dashboard.bookings.edit', {
                url: '/edit/:booking_id',
                controller: 'BookingsController',
                templateUrl: 'views/bookings/edit_booking.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit',
                    return_to: 'bookings'
                }
            })

            .state('dashboard.bookings.edit_from_bookout', {
                url: '/edit_from_bookout/:booking_id',
                controller: 'BookingsController',
                templateUrl: 'views/bookings/edit_booking.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit',
                    return_to: 'bookout'
                }
            })

            //instructor_holidays



            // .state('/upload_images', {
            //     controller: 'UploadController',
            //     templateUrl: 'views/upload_images.html',
            //     controllerAs: 'vm'
            // })



        //MY ACCOUNT PAGES

        .state('dashboard.my_account', {
            url: '/my_account',
            templateUrl: 'views/my_account/home.html',
            controller: 'MyAccountController'
        })

        .state('dashboard.my_account.manage', {
            url: '/manage',
            templateUrl: 'views/my_account/account.html',
            controllerAs: 'vm',
            controller: 'ManageAccountController'
        })


        // BOOKOUT PAGES

        .state('dashboard.my_account.bookout', {
            url: '/bookout',
            templateUrl: 'views/my_account/booking_out_form.html',
            controller: 'BookoutController',
            controllerAs: 'vm',
                data: {
                    action: 'list'
                }
        })

        .state('dashboard.my_account.bookout.edit', {
            url: '/bookout/:bookout_id',
            templateUrl: 'views/my_account/booking_out_form.html',
            controller: 'BookoutController',
            controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
        })

        .state('dashboard.my_account.bookout_with_booking', {
            url: '/bookout/:booking_id',
            templateUrl: 'views/my_account/booking_out_form.html',
            controller: 'BookoutController',
            controllerAs: 'vm',
                data: {
                    action: 'add'
                }
        })

        .state('dashboard.my_account.booked_out', {
            url: '/booked_out/:booking_id',
            templateUrl: 'views/my_account/booked_out.html',
            controller: 'BookoutController',
            controllerAs: 'vm',
                data: {
                    action: 'add'
                }
        })

        .state('dashboard.my_account.book_in', {
            url: '/book_in/:id',
            templateUrl: 'views/my_account/booking_in_form.html',
            controller: 'BookinController',
            controllerAs: 'vm',
                data: {
                    action: 'add'
                }
        })


        .state('dashboard.my_account.finish_and_pay', {
            url: '/finish_and_pay/:id',
            templateUrl: 'views/my_account/finish_and_pay.html',
            controller: 'FinishAndPayController',
            controllerAs: 'vm',
                data: {
                    action: 'add'
                }
        })


        //LICENCES

        .state('dashboard.my_account.licence', {
            url: '/licence',
            templateUrl: 'views/my_account/licence.html',
            controller: 'ManageLicenceController',
            controllerAs: 'vm',
                data: {
                    action: 'list'
                }
        })

        .state('dashboard.my_account.licence.edit', {
            url: '/edit/:licence_id',
            templateUrl: 'views/my_account/licence_form.html',
            controller: 'ManageLicenceController',
            controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
        })

        .state('dashboard.my_account.licence.add', {
            url: '/add',
            templateUrl: 'views/my_account/licence_form.html',
            controller: 'ManageLicenceController',
            controllerAs: 'vm',
                data: {
                    action: 'add'
                }
        })



        //MEDICALS
        .state('dashboard.my_account.medical', {
            url: '/medical',
            templateUrl: 'views/my_account/medical.html',
            controller: 'ManageMedicalController',
            controllerAs: 'vm',
                data: {
                    action: 'list'
                }
        })

        .state('dashboard.my_account.medical.edit', {
            url: '/edit/:medical_id',
            templateUrl: 'views/my_account/medical_form.html',
            controller: 'ManageMedicalController',
            controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
        })

        .state('dashboard.my_account.medical.add', {
            url: '/add',
            templateUrl: 'views/my_account/medical_form.html',
            controller: 'ManageMedicalController',
            controllerAs: 'vm',
                data: {
                    action: 'add'
                }
        })




        //DIFFERENCES TRAINING
        .state('dashboard.my_account.differences', {
            url: '/differences',
            templateUrl: 'views/my_account/differences.html',
            controller: 'ManageDifferencesController',
            controllerAs: 'vm'
        })

        .state('dashboard.my_account.claim_a_flight', {
            url: '/claim_a_flight',
            templateUrl: 'views/my_account/claim_a_flight.html',
            controller: 'ClaimAFlightController',
            controllerAs: 'vm'
        })



        .state('dashboard.my_account.aircraft_status2', {
            url: '/aircraft_status/:registration',
            templateUrl: 'views/my_account/aircraft_status.html',
            controller: 'AircraftStatusController',
            controllerAs: 'vm'
        })

        .state('dashboard.my_account.aircraft_status', {
            url: '/aircraft_status',
            templateUrl: 'views/my_account/aircraft_status.html',
            controller: 'AircraftStatusController',
            controllerAs: 'vm'
        })

        .state('dashboard.my_account.aircraft_journey_log', {
            url: '/aircraft_journey_log/:plane_id',
            templateUrl: 'views/my_account/aircraft_journey_log.html',
            controller: 'AircraftJourneyLogsController',
            controllerAs: 'vm'
        })


        .state('dashboard.my_account.my_journey_log', {
            url: '/my_journey_log',
            templateUrl: 'views/my_account/my_journey_log.html',
            controller: 'MyJourneyLogsController',
            controllerAs: 'vm'
        })

        //ALL CLUB / PLANE DOCUMENTS
        .state('dashboard.my_account.all_documents', {
            url: '/all_documents',
            templateUrl: 'views/my_account/all_documents.html',
            controller: 'AllDocumentsController',
            controllerAs: 'vm'
        })



         //ALL CLUB / PLANE DOCUMENTS
        .state('dashboard.my_account.all_prices', {
            url: '/price_list',
            templateUrl: 'views/my_account/all_prices.html',
            controller: 'AllDocumentsController',
            controllerAs: 'vm'
        })


        //ALL INVOICES
        .state('dashboard.my_account.invoices', {
            url: '/invoices',
            templateUrl: 'views/my_account/all_invoices.html',
            controller: 'AllInvoicesController',
            controllerAs: 'vm'
        })

        //ALL PAYMENTS
        .state('dashboard.my_account.payments', {
            url: '/payments',
            templateUrl: 'views/my_account/all_payments.html',
            controller: 'AllPaymentsController',
            controllerAs: 'vm'
        })


        //PROOF OF ID
        .state('dashboard.my_account.poid', {
            url: '/proof_of_id',
            templateUrl: 'views/my_account/poid.html',
            controller: 'ManagePoidController',
            controllerAs: 'vm',
                data: {
                    action: 'list'
                }
        })

        .state('dashboard.my_account.poid.edit', {
            url: '/edit/:poid_id',
            templateUrl: 'views/my_account/poid_form.html',
            controller: 'ManagePoidController',
            controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
        })

        .state('dashboard.my_account.poid.add', {
            url: '/add',
            templateUrl: 'views/my_account/poid_form.html',
            controller: 'ManagePoidController',
            controllerAs: 'vm',
                data: {
                    action: 'add'
                }
        })



        //PAYMENT METHODS STRIPY
        .state('dashboard.my_account.payment_methods', {
            url: '/payment_methods',
            templateUrl: 'views/my_account/payments.html',
            controller: 'ManagePaymentsController',
            controllerAs: 'vm',
                data: {
                    action: 'list'
                }
        })

        .state('dashboard.my_account.payment_methods.add', {
            url: '/add',
            templateUrl: 'views/my_account/payments_form.html',
            controller: 'ManagePaymentsAddController',
            controllerAs: 'vm',
                data: {
                    action: 'add'
                }
        })


        .state('dashboard.my_account.memberships', {
            url: '/memberships',
            templateUrl: 'views/my_account/memberships.html',
            controller: 'ManageMyMembershipsController',
            controllerAs: 'vm',
                data: {
                    action: 'list'
                }
        })

        .state('dashboard.my_account.memberships.direct_debit', {
            url: '/direct-debit',
            templateUrl: 'views/my_account/memberships_direct_debit.html',
            controller: 'ManageMyMembershipsDirectDebitController',
            controllerAs: 'vm',
                data: {
                    action: 'direct_debit'
                }
        })

        .state('dashboard.my_account.memberships.add', {
            url: '/add',
            templateUrl: 'views/my_account/memberships_join.html',
            controller: 'ManageMyMembershipsController',
            controllerAs: 'vm',
                data: {
                    action: 'add'
                }
        })
        
        .state('dashboard.my_account.memberships.accept', {
            url: '/accept/:request_id',
            templateUrl: 'views/my_account/memberships_accept.html',
            controller: 'ManageMyMembershipsController',
            controllerAs: 'vm',
                data: {
                    action: 'accept'
                }
        })

        .state('dashboard.my_account.memberships.edit', {
            url: '/edit/:membership_id',
            templateUrl: 'views/my_account/memberships_edit.html',
            controller: 'ManageMyMembershipsController',
            controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
        })


        .state('dashboard.my_account.memberships.update_direct_debit', {
            url: '/edit/:membership_id/update_direct_debit',
            templateUrl: 'views/my_account/update_direct_debit.html',
            controller: 'UpdateMyMembershipDirectDebitController',
            controllerAs: 'vm',
                data: {
                    action: 'direct_debit2'
                }
        })


        //update_direct_debit



        //NEXT OF KIN
        .state('dashboard.my_account.nok', {
            url: '/next_of_kin',
            templateUrl: 'views/my_account/nok.html',
            controller: 'ManageNokController',
            controllerAs: 'vm',
                data: {
                    action: 'list'
                }
        })

        .state('dashboard.my_account.nok.edit', {
            url: '/edit/:nok_id',
            templateUrl: 'views/my_account/nok_form.html',
            controller: 'ManageNokController',
            controllerAs: 'vm',
                data: {
                    action: 'edit'
                }
        })

        .state('dashboard.my_account.nok.add', {
            url: '/add',
            templateUrl: 'views/my_account/nok_form.html',
            controller: 'ManageNokController',
            controllerAs: 'vm',
                data: {
                    action: 'add'
                }
        })

        

        //CLUB SIGNUP FORM

        .state('club_signup', {
            url: '/club_signup',
            templateUrl: 'views/forms/club_signup/form.html',
            controller: 'ClubSignupController',
            controllerAs: 'vm',
                data: {
                }
        })
         
        .state('club_signup.my_profile', {
            url: '/my_profile',
            templateUrl: 'views/forms/club_signup/form-profile.html'
        })
        
        .state('club_signup.my_club', {
            url: '/my_club',
            templateUrl: 'views/forms/club_signup/form-club.html'
        })

        .state('club_signup.terms', {
            url: '/terms',
            templateUrl: 'views/forms/club_signup/form-terms.html'
        })

        .state('club_signup.verify', {
            url: '/verify',
            templateUrl: 'views/forms/club_signup/form-verify.html'
        })
        
        // .state('club_signup.payment', {
        //     url: '/payment',
        //     templateUrl: 'views/forms/club_signup/form-payment.html'
        // })

        // .state('club_signup.payment_setup_confirmation', {
        //     url: '/payment_setup_confirmation',
        //     templateUrl: 'views/forms/club_signup/form-payment-confirmation.html'
        // })

        
        .state('club_signup2', {
            url: '/club_signup2',
            templateUrl: 'views/forms/club_signup_continued/form.html',
            controller: 'ClubSignupController',
            controllerAs: 'vm'
                
        })

        .state('club_signup2.verify', {
            url: '/verified/:token/:userId',
            templateUrl: 'views/forms/club_signup_continued/form-verified_email.html'
        })

        // .state('registration_verification', {
        //         url: '/registration_verification/:userId/:token',
        //         controller: 'RegisterController',
        //         templateUrl: 'views/registration_verification.html',
        //         controllerAs: 'vm'
        //     })

        .state('club_signup2.payment', {
            url: '/payment',
            templateUrl: 'views/forms/club_signup_continued/form-payment.html'
        })
        
        .state('club_signup2.payment_setup_confirmation', {
            url: '/payment_setup_confirmation',
            templateUrl: 'views/forms/club_signup_continued/form-payment-confirmation.html'
        })

        .state('club_signup2.payment2', {
            url: '/card_payment_confirmation',
            templateUrl: 'views/forms/club_signup_continued/form-payment-stripe.html'
        })

        .state('club_signup2.payment_setup_confirmation2', {
            url: '/payment_confirmation',
            templateUrl: 'views/forms/club_signup_continued/form-payment-confirmation.html'
        })

        .state('club_signup2.complete', {
            url: '/complete',
            templateUrl: 'views/forms/club_signup_continued/form-complete.html'
        })
        



        // .state('club_signup3', {
        //     url: '/club_signup3',
        //     templateUrl: 'views/forms/club_signup_continued/form.html',
        //     controller: 'ClubSignupController',
        //     controllerAs: 'vm',
        //         data: {
        //         }
        // })

        // .state('club_signup2.verify', {
        //     url: '/verified',
        //     templateUrl: 'views/forms/club_signup_continued/form-verified_email.html'
        // })

        // .state('club_signup2.payment', {
        //     url: '/payment',
        //     templateUrl: 'views/forms/club_signup_continued/form-payment.html'
        // })
        
        // .state('club_signup2.payment_setup_confirmation', {
        //     url: '/payment_confirmation',
        //     templateUrl: 'views/forms/club_signup_continued/form-payment-confirmation.html'
        // })

        // .state('club_signup2.payment2', {
        //     url: '/card_payment_confirmation',
        //     templateUrl: 'views/forms/club_signup_continued/form-payment-stripe.html'
        // })

        // .state('club_signup2.payment_setup_confirmation2', {
        //     url: '/payment_confirmation',
        //     templateUrl: 'views/forms/club_signup_continued/form-payment-confirmation.html'
        // })



        //INVITE A USER
        .state('invitations', {
            url: '/invitations/:token',
            templateUrl: 'views/forms/invitation_signup/form.html',
            controller: 'InvitationsSignupController',
            controllerAs: 'vm'
        })

        
        .state('invitations.introduction', {
            url: '/introduction',
            templateUrl: 'views/forms/invitation_signup/form-introduction.html'
        })
        
        .state('invitations.your_details', {
            url: '/your_details',
            templateUrl: 'views/forms/invitation_signup/form-profile.html'
        })
        
        .state('invitations.next_of_kin', {
            url: '/next_of_kin',
            templateUrl: 'views/forms/invitation_signup/form-nok.html'
        })

        .state('invitations.your_club', {
            url: '/your_club',
            templateUrl: 'views/forms/invitation_signup/form-club.html'
        })

        .state('invitations.direct_debit', {
            url: '/direct_debit',
            templateUrl: 'views/forms/invitation_signup/form-direct-debit.html'
        })

        .state('invitations.tnc', {
            url: '/terms-and-conditions',
            templateUrl: 'views/forms/invitation_signup/form-tnc.html'
        })

        .state('invitations.verified', {
            url: '/verified',
            templateUrl: 'views/forms/invitation_signup/verified.html'
        })




        //USER SIGNUP FORM

        .state('user_signup', {
            url: '/user_signup',
            templateUrl: 'views/forms/user_signup/form.html',
            controller: 'UserSignupController'
        })
        
        .state('user_signup.next_of_kin', {
            url: '/next_of_kin',
            templateUrl: 'views/forms/user_signup/form-nok.html'
        })

        .state('user_signup.your_club', {
            url: '/your_club',
            templateUrl: 'views/forms/user_signup/form-club.html'
        })

        .state('user_signup.your_club_confirmation', {
            url: '/your_club_confirmation',
            templateUrl: 'views/forms/user_signup/form-club-two.html'
        })

        .state('user_signup.your_membership', {
            url: '/your_membership',
            templateUrl: 'views/forms/user_signup/form-club-three.html'
        })
        
        .state('user_signup.your_details', {
            url: '/your_details',
            templateUrl: 'views/forms/user_signup/form-profile.html'
        })

        .state('user_signup.your_license_check', {
            url: '/license_check',
            templateUrl: 'views/forms/user_signup/form-license-check.html'
        })
        
        .state('user_signup.your_license', {
            url: '/license',
            templateUrl: 'views/forms/user_signup/form-license.html'
        })

        .state('user_signup.your_medical', {
            url: '/medical',
            templateUrl: 'views/forms/user_signup/form-medical.html'
        })

        .state('user_signup.tnc', {
            url: '/terms-and-conditions',
            templateUrl: 'views/forms/user_signup/form-tnc.html'
        })

        .state('user_signup.verify_account', {
            url: '/verify/:user_id?verify',
            templateUrl: 'views/forms/user_signup/verify.html'
        })

        .state('user_signup.verified', {
            url: '/verified',
            templateUrl: 'views/forms/user_signup/verified.html'
        })



        //PASSENGER SIGNUP FORM
        .state('passenger_signup', {
            url: '/passenger_signup/:token',
            templateUrl: 'views/forms/passenger_signup/form.html',
            controller: 'PassengerSignupController'
        })
         
        .state('passenger_signup.check', {
            url: '/check',
            templateUrl: 'views/forms/passenger_signup/form-check.html'
        })

        // .state('passenger_signup.login', {
        //     url: '/login',
        //     templateUrl: 'views/forms/passenger_signup/form-login.html'
        // })

        .state('passenger_signup.your_profile', {
            url: '/my_profile',
            templateUrl: 'views/forms/passenger_signup/form-profile.html'
        })
        
        // .state('passenger_signup.guardian', {
        //     url: '/guardian',
        //     templateUrl: 'views/forms/passenger_signup/form-guardian.html'
        // })

        .state('passenger_signup.next_of_kin', {
            url: '/next_of_kin',
            templateUrl: 'views/forms/passenger_signup/form-nok.html'
        })

        // .state('passenger_signup.remember_me', {
        //     url: '/remember_me',
        //     templateUrl: 'views/forms/passenger_signup/form-remember-me.html'
        // })

        .state('passenger_signup.thank_you', {
            url: '/thank-you',
            templateUrl: 'views/forms/passenger_signup/thank-you.html'
        })

        .state('passenger_signup.tnc', {
            url: '/terms-and-conditions',
            templateUrl: 'views/forms/passenger_signup/form-tnc.html'
        })





        //passenger_signup_complete
        



        .state('passenger_signup_complete', {
            url: '/passenger_signup_complete/:token',
            templateUrl: 'views/forms/passenger_signup_complete/form.html',
            controller: 'PassengerSignupCompleteController'
        })
        .state('passenger_signup_complete.check', {
            url: '/check',
            templateUrl: 'views/forms/passenger_signup_complete/check.html'
        })
        .state('passenger_signup_complete.your_profile', {
            url: '/create',
            templateUrl: 'views/forms/passenger_signup_complete/form-profile.html'
        })
        .state('passenger_signup_complete.thank_you', {
            url: '/thank-you',
            templateUrl: 'views/forms/passenger_signup_complete/thank_you.html'
        });

        $urlRouterProvider.otherwise('/login');

    }
    

    //CreateGalleryController

    //flow bits
    // flowFactoryProvider.defaults = {
    //     target: '/upload',
    //     permanentErrors:[404, 500, 501]
    // };
    // // You can also set default events:
    // flowFactoryProvider.on('catchAll', function (event) {
    //   //not sure?
    // });
    // Can be used with different implementations of Flow.js
    // flowFactoryProvider.factory = fustyFlowFactory;
  


    /**
     * AngularJS default filter with the following expression:
     * "person in people | filter: {name: $select.search, age: $select.search}"
     * performs a AND between 'name: $select.search' and 'age: $select.search'.
     * We want to perform a OR.
     */
    app.filter('propsFilter', function() {
      return function(items, props) {


        var out = [];

        var alpha = "";

        if (angular.isArray(items)) {
          var keys = Object.keys(props);
            
          items.forEach(function(item) {
            var itemMatches = false;
            for (var i = 0; i < keys.length; i++) {
              var prop = keys[i];
              if(props[prop] && item[prop]){
                  var text = props[prop].toLowerCase();
                  if (item[prop].toString().toLowerCase().indexOf(text) !== -1) {
                    itemMatches = true;
                    break;
                  }
                  // console.log("TEZT:", text);
                  // //potential catch here?
                  // if(text && text.length == 0){
                  //     console.log("nothing");
                  // }
                  // if(text && text.length > 0){
                  //     console.log("TEXT", text);
                  //     alpha = text;
                  // }
              }

            }

            if (itemMatches) {
              out.push(item);
            }
          });
        } else {
          // Let the output be the input untouched
          out = items;
        }



        //if no matches - return all options?
        // if(out && out.length == 0){
        //     out = items;
        // }

        // if(out.length == 0){
        //     // console.log("OUT --> ", props.length);
        //     var xo = 0;
        //     var keys = Object.keys(props);
        //     console.log("KEY LENGTH", keys.length);
        //     for (var i = 0; i < keys.length; i++) {
        //         var pop = keys[i];
        //         console.log("POP", pop);
        //         console.log("POP", props[pop]);
        //         if(props[keys[i]] == ""){
        //             console.log("t is blank", keys[i]);
        //             xo++;
        //         }
        //     }
        //     if(xo == keys.length){
        //         console.log("LOAD ALL");
        //     }
        // }
        

        return out;
      };
    });


     app.filter('propsFilterA', function() {
      return function(items, props) {


        var out = [];

        var alpha = "";

        if (angular.isArray(items)) {
          var keys = Object.keys(props);
            
          items.forEach(function(item) {
            var itemMatches = false;
            for (var i = 0; i < keys.length; i++) {
              var prop = keys[i];
              if(props[prop] && item[prop]){
                  var text = props[prop].toString().toLowerCase();
                  if (item[prop].toString().toLowerCase().indexOf(text) !== -1) {
                    itemMatches = true;
                    break;
                  }
                  // console.log("TEZT:", text);
                  // //potential catch here?
                  // if(text && text.length == 0){
                  //     console.log("nothing");
                  // }
                  // if(text && text.length > 0){
                  //     console.log("TEXT", text);
                  //     alpha = text;
                  // }
              }

            }

            if (itemMatches) {
              out.push(item);
            }
          });
        } else {
          // Let the output be the input untouched
          out = items;
        }



        //if no matches - return all options?
        if(out && out.length == 0){
            out = items;
        }

        // if(out.length == 0){
        //     // console.log("OUT --> ", props.length);
        //     var xo = 0;
        //     var keys = Object.keys(props);
        //     console.log("KEY LENGTH", keys.length);
        //     for (var i = 0; i < keys.length; i++) {
        //         var pop = keys[i];
        //         console.log("POP", pop);
        //         console.log("POP", props[pop]);
        //         if(props[keys[i]] == ""){
        //             console.log("t is blank", keys[i]);
        //             xo++;
        //         }
        //     }
        //     if(xo == keys.length){
        //         console.log("LOAD ALL");
        //     }
        // }
        

        return out;
      };
    });



 	
 	//RUN INJECT
    run.$inject = ['$rootScope', '$location', '$cookieStore', '$http'];
    function run($rootScope, $location, $cookieStore, $http) {
        // keep user logged in after page refresh

        //console.log("RUNNING");

        $rootScope.globals = $cookieStore.get('globals') || {};
        if ($rootScope.globals.currentUser) {
            $http.defaults.headers.common['Authorization'] = 'Basic ' + $rootScope.globals.currentUser.authdata; // jshint ignore:line
           try{
            $http.defaults.headers.common["Session"] = $cookieStore.get('session');
        } catch(e){
            console.log("failed to get the session again.. no idea why.")
        }
        }
 
        $rootScope.$on('$locationChangeStart', function (event, next, current) {
            // redirect to login page if not logged in and trying to access a restricted page
            //console.log($location.path());
            var restrictedPage = $.inArray($location.path(), ['/login', '/register', '/gallery', '/disabled', '/club_signup', '/user_signup', '/passenger_signup']) === -1;

            //check again... if contains gallery:::
            if($location.path().indexOf("/user_signup") > -1){
                restrictedPage = true;
            }

            //check again... if contains gallery:::
            if($location.path().indexOf("/club_signup") > -1){
                restrictedPage = false;
            }

            //check again... if contains gallery:::
            if($location.path().indexOf("/passenger_signup") > -1){
                restrictedPage = false;
            }

            console.log(restrictedPage);
            var loggedIn = $rootScope.globals.currentUser;
            if(restrictedPage && !loggedIn){
                //$location.path('/login');
                //UNCOMMENT ABOVE
            } else {
                // need to expand on this with regards to access control
                // $rootScope.globals.currentUser.access_level; 
            }

        });
    }