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
    app.factory('apiUrlInterceptor', ['EnvConfig', '$q', function(EnvConfig, $q) {
        // ── Circuit breaker ──────────────────────────────────────────────
        // Safety net against request storms: if the SAME GET endpoint fails
        // repeatedly in a short window (e.g. backend unreachable / cert rejected,
        // or an external script replaying requests), stop issuing it. Prevents the
        // browser-crashing flood seen when local-api is down. A success or the
        // cooldown window resets the counter so normal use is unaffected.
        var FAIL_LIMIT = 6;          // identical failures before tripping
        var COOLDOWN_MS = 10000;     // window after which a tripped endpoint is retried
        var failures = {};           // key -> { count, trippedAt }

        function keyFor(config) {
            return (config.method || 'GET').toUpperCase() + ' ' + (config.url || '');
        }

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

                // Block requests to an endpoint that has tripped the breaker,
                // until its cooldown elapses.
                var rec = failures[keyFor(config)];
                if (rec && rec.count >= FAIL_LIMIT) {
                    var since = (rec.trippedAt ? (new Date().getTime() - rec.trippedAt) : COOLDOWN_MS + 1);
                    if (since < COOLDOWN_MS) {
                        return $q.reject({
                            data: null,
                            status: -1,
                            config: config,
                            _circuitOpen: true,
                            statusText: 'Request blocked by client circuit breaker (endpoint failing repeatedly).'
                        });
                    }
                    // Cooldown elapsed — allow one probe through and reset.
                    delete failures[keyFor(config)];
                }

                return config;
            },
            response: function(response) {
                // Any success clears that endpoint's failure record.
                delete failures[keyFor(response.config || {})];
                return response;
            },
            responseError: function(rejection) {
                var cfg = rejection && rejection.config;
                // Don't double-count our own breaker rejections.
                if (cfg && !rejection._circuitOpen) {
                    var k = keyFor(cfg);
                    var rec = failures[k] || { count: 0, trippedAt: null };
                    rec.count++;
                    if (rec.count >= FAIL_LIMIT && !rec.trippedAt) {
                        rec.trippedAt = new Date().getTime();
                        console.warn('Circuit breaker tripped for ' + k + ' after ' + rec.count + ' failures — pausing for ' + (COOLDOWN_MS / 1000) + 's.');
                    }
                    failures[k] = rec;
                }
                return $q.reject(rejection);
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
		    target: 'upload.php', // overridden per-directive via $root.uploadUrl / $root.uploadDocumentsUrl
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

            // ── Display Pairing (public, no auth — must be before schedule_display) ──
            .state('display_pairing', {
                url: '/display/tv',
                templateUrl: 'views/display_pairing.html',
                controller: 'DisplayPairingController',
                controllerAs: 'vm'
            })

            // ── Schedule Display (public, no auth) ──
            .state('schedule_display', {
                url: '/display/:token',
                templateUrl: 'views/schedule_display.html',
                controller: 'ScheduleDisplayController',
                controllerAs: 'vm'
            })

            // ── Airfield Bookout — Public Pilot Form (no auth) ──
            .state('airfield_bookout_form', {
                url: '/bookout/:icao',
                templateUrl: 'views/airfield_bookout_form.html',
                controller: 'AirfieldBookoutFormController',
                controllerAs: 'vm'
            })

            // ── Airfield Bookout — Controller Display (no auth, token-based) ──
            .state('airfield_bookout_display', {
                url: '/bookout-display/:token',
                templateUrl: 'views/airfield_bookout_display.html',
                controller: 'AirfieldBookoutDisplayController',
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


            // ── FLIGHT REPLAY / DEBRIEF ──
            // Shared detail page reachable from My Logbook, the aircraft journey
            // log and student records. :flight_id is a plane_log_sheets.id.
            .state('dashboard.flight_replay', {
                url: '/flight_replay/:flight_id',
                controller: 'FlightReplayController',
                templateUrl: 'views/flight_replay.html',
                controllerAs: 'vm'
            })


            // ── MAINTENANCE ORGANISATION WORKSPACE ──
            .state('dashboard.maintenance', {
                url: '/maintenance',
                controller: 'DashboardMaintenanceController',
                templateUrl: 'views/maintenance/home.html',
                controllerAs: 'vm'
            })

            .state('dashboard.maintenance.fleet', {
                url: '/fleet',
                controller: 'MaintenanceFleetController',
                templateUrl: 'views/maintenance/fleet.html',
                controllerAs: 'vm'
            })

            .state('dashboard.maintenance.fleet.aircraft', {
                url: '/aircraft/:plane_id',
                controller: 'MaintenanceFleetController',
                templateUrl: 'views/maintenance/fleet.html',
                controllerAs: 'vm'
            })

            .state('dashboard.maintenance.members', {
                url: '/members',
                controller: 'MaintenanceMembersController',
                templateUrl: 'views/maintenance/members.html',
                controllerAs: 'vm'
            })

            .state('dashboard.maintenance.licences', {
                url: '/licences',
                controller: 'MaintenanceLicencesController',
                templateUrl: 'views/maintenance/licences.html',
                controllerAs: 'vm'
            })

            .state('dashboard.maintenance.settings', {
                url: '/settings',
                controller: 'MaintenanceSettingsController',
                templateUrl: 'views/maintenance/settings.html',
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


            // ════════════════════════════════════════════════════
            // QUESTIONNAIRES & POST-MATERIAL (authoring + review)
            // attach_type/attach_id identify the course/lesson context.
            // ════════════════════════════════════════════════════
            // Manage a course's/lesson's questionnaires + materials (instructor/admin)
            .state('dashboard.manage_club.course_content', {
                url: '/course_content/:attach_type/:attach_id?title',
                controller: 'CourseContentController',
                templateUrl: 'views/manageclub/course_content/manage.html',
                controllerAs: 'vm',
                data: { screen: 'manage' }
            })
            // Questionnaire builder (author questions/options/links)
            .state('dashboard.manage_club.questionnaire_builder', {
                url: '/questionnaire/:questionnaire_id/build',
                controller: 'CourseContentController',
                templateUrl: 'views/manageclub/course_content/builder.html',
                controllerAs: 'vm',
                data: { screen: 'builder' }
            })
            // Review queue for a questionnaire
            .state('dashboard.manage_club.questionnaire_attempts', {
                url: '/questionnaire/:questionnaire_id/attempts',
                controller: 'CourseContentController',
                templateUrl: 'views/manageclub/course_content/attempts.html',
                controllerAs: 'vm',
                data: { screen: 'attempts' }
            })
            // Instructor: search a student → all their questionnaire attempts
            .state('dashboard.manage_user.student_questionnaires', {
                url: '/student_questionnaires?student_id',
                controller: 'CourseContentController',
                templateUrl: 'views/manageclub/course_content/student.html',
                controllerAs: 'vm',
                data: { screen: 'student' }
            })
            // Review a single attempt (mark + notes + release)
            .state('dashboard.manage_club.questionnaire_review', {
                url: '/questionnaire/attempt/:attempt_id/review',
                controller: 'CourseContentController',
                templateUrl: 'views/manageclub/course_content/review.html',
                controllerAs: 'vm',
                data: { screen: 'review' }
            })
            // Material engagement / access report
            .state('dashboard.manage_club.material_access', {
                url: '/material/:material_id/access',
                controller: 'CourseContentController',
                templateUrl: 'views/manageclub/course_content/access.html',
                controllerAs: 'vm',
                data: { screen: 'access' }
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


            // ════════════════════════════════════════════════════
            // STUDENT — questionnaires & post-material
            // ════════════════════════════════════════════════════
            // "Assigned to me" merged into the questionnaires hub. The old
            // /assigned URL still works — it just renders the same merged hub
            // (deep links / emails may point here).
            .state('dashboard.my_account.assigned', {
                url: '/assigned',
                templateUrl: 'views/my_account/questionnaires/mine.html',
                controller: 'StudentQuestionnaireController',
                controllerAs: 'vm',
                data: { screen: 'mine' }
            })
            // The student's questionnaire hub: instructor-assigned tasks on top,
            // full attempt history below.
            .state('dashboard.my_account.questionnaires', {
                url: '/questionnaires',
                templateUrl: 'views/my_account/questionnaires/mine.html',
                controller: 'StudentQuestionnaireController',
                controllerAs: 'vm',
                data: { screen: 'mine' }
            })
            // Complete/continue a questionnaire (optionally in a course/lesson context).
            .state('dashboard.my_account.questionnaire_take', {
                url: '/questionnaire/:questionnaire_id/take?attach_type&attach_id&timing&sitting',
                templateUrl: 'views/my_account/questionnaires/take.html',
                controller: 'StudentQuestionnaireController',
                controllerAs: 'vm',
                data: { screen: 'take' }
            })
            // View a completed/reviewed attempt (released score + instructor notes).
            .state('dashboard.my_account.questionnaire_result', {
                url: '/questionnaire/attempt/:attempt_id',
                templateUrl: 'views/my_account/questionnaires/result.html',
                controller: 'StudentQuestionnaireController',
                controllerAs: 'vm',
                data: { screen: 'result' }
            })
            // Read a post-lesson/course material (encrypted PDF, engagement tracked).
            .state('dashboard.my_account.material_view', {
                url: '/material/:material_id',
                templateUrl: 'views/my_account/questionnaires/material.html',
                controller: 'StudentQuestionnaireController',
                controllerAs: 'vm',
                data: { screen: 'material' }
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
                url: '/briefing/:booking_id/lesson/:lesson_id/:club_id',
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





            // ACCOUNTING EXPORT

            .state('dashboard.manage_club.accounting_export', {
                url: '/accounting_export',
                controller: 'DashboardAccountingExportController',
                templateUrl: 'views/manageclub/accounting_export.html',
                controllerAs: 'vm'
            })

            // CLUB STATISTICS

            .state('dashboard.manage_club.club_stats', {
                url: '/club_stats',
                controller: 'DashboardClubStatsController',
                templateUrl: 'views/manageclub/club_stats.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            // FOX TRACKER MANAGEMENT (ToAviate admin only)

            .state('dashboard.manage_club.fox_trackers', {
                url: '/fox_trackers',
                controller: 'DashboardFoxTrackersController',
                templateUrl: 'views/manageclub/fox_trackers.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_club.fox_tracker_detail', {
                url: '/fox_trackers/:tracker_id',
                controller: 'DashboardFoxTrackersController',
                templateUrl: 'views/manageclub/fox_tracker_detail.html',
                controllerAs: 'vm',
                data: {
                    action: 'detail'
                }
            })

            .state('dashboard.manage_club.fox_tracker_add', {
                url: '/fox_trackers_add',
                controller: 'DashboardFoxTrackersController',
                templateUrl: 'views/manageclub/fox_tracker_form.html',
                controllerAs: 'vm',
                data: {
                    action: 'add'
                }
            })

            // TRACKER ↔ PLANE ASSIGNMENT

            .state('dashboard.manage_club.tracker_planes', {
                url: '/tracker_planes',
                controller: 'DashboardTrackerPlaneController',
                templateUrl: 'views/manageclub/tracker_planes.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })

            .state('dashboard.manage_club.tracker_plane_detail', {
                url: '/tracker_planes/:plane_id',
                controller: 'DashboardTrackerPlaneController',
                templateUrl: 'views/manageclub/tracker_plane_detail.html',
                controllerAs: 'vm',
                data: {
                    action: 'detail'
                }
            })

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

            .state('dashboard.manage_club.automations', {
                url: '/settings/automations',
                controller: 'DashboardClubAutomationsController',
                templateUrl: 'views/manageclub/automations.html',
                controllerAs: 'vm'
            })

            // VOUCHER WIDGET
            .state('dashboard.manage_club.voucher_widget', {
                url: '/voucher_widget',
                controller: 'DashboardClubVoucherWidgetController',
                templateUrl: 'views/manageclub/voucher_widget.html',
                controllerAs: 'vm'
            })

            // CRON STATUS (super-admin only)
            .state('dashboard.manage_club.cron_status', {
                url: '/cron_status',
                controller: 'CronStatusController',
                templateUrl: 'views/manageclub/cron_status.html',
                controllerAs: 'vm'
            })

            // BOOKEDSCHEDULER SYNC
            .state('dashboard.manage_club.bs_sync', {
                url: '/bs_sync',
                controller: 'DashboardClubBsSyncController',
                templateUrl: 'views/manageclub/bs_sync.html',
                controllerAs: 'vm'
            })

            // AIRFIELD BOOKOUT SYSTEM (Admin Settings)
            .state('dashboard.manage_club.airfield_bookout', {
                url: '/airfield_bookout',
                controller: 'DashboardClubAirfieldBookoutController',
                templateUrl: 'views/manageclub/airfield_bookout.html',
                controllerAs: 'vm'
            })


            // ════════════════════════════════════════════════════
            // SAFETY MANAGEMENT SYSTEM (SMS) — admin / SMS staff
            // All share SmsController; the screen is chosen by data.screen.
            // ════════════════════════════════════════════════════
            .state('dashboard.manage_club.sms', {
                url: '/sms',
                controller: 'SmsController',
                templateUrl: 'views/manageclub/sms/dashboard.html',
                controllerAs: 'vm',
                data: { screen: 'dashboard' }
            })
            .state('dashboard.manage_club.sms_hazards', {
                url: '/sms/hazards',
                controller: 'SmsController',
                templateUrl: 'views/manageclub/sms/hazards.html',
                controllerAs: 'vm',
                data: { screen: 'hazards' }
            })
            .state('dashboard.manage_club.sms_occurrences', {
                url: '/sms/occurrences',
                controller: 'SmsController',
                templateUrl: 'views/manageclub/sms/occurrences.html',
                controllerAs: 'vm',
                data: { screen: 'occurrences' }
            })
            .state('dashboard.manage_club.sms_risks', {
                url: '/sms/risks',
                controller: 'SmsController',
                templateUrl: 'views/manageclub/sms/risks.html',
                controllerAs: 'vm',
                data: { screen: 'risks' }
            })
            .state('dashboard.manage_club.sms_actions', {
                url: '/sms/actions',
                controller: 'SmsController',
                templateUrl: 'views/manageclub/sms/actions.html',
                controllerAs: 'vm',
                data: { screen: 'actions' }
            })
            .state('dashboard.manage_club.sms_audits', {
                url: '/sms/audits',
                controller: 'SmsController',
                templateUrl: 'views/manageclub/sms/audits.html',
                controllerAs: 'vm',
                data: { screen: 'audits' }
            })
            .state('dashboard.manage_club.sms_documents', {
                url: '/sms/documents',
                controller: 'SmsController',
                templateUrl: 'views/manageclub/sms/documents.html',
                controllerAs: 'vm',
                data: { screen: 'documents' }
            })
            .state('dashboard.manage_club.sms_meetings', {
                url: '/sms/meetings',
                controller: 'SmsController',
                templateUrl: 'views/manageclub/sms/meetings.html',
                controllerAs: 'vm',
                data: { screen: 'meetings' }
            })
            .state('dashboard.manage_club.sms_change', {
                url: '/sms/change',
                controller: 'SmsController',
                templateUrl: 'views/manageclub/sms/change.html',
                controllerAs: 'vm',
                data: { screen: 'change' }
            })
            .state('dashboard.manage_club.sms_instructors', {
                url: '/sms/instructors',
                controller: 'SmsController',
                templateUrl: 'views/manageclub/sms/instructors.html',
                controllerAs: 'vm',
                data: { screen: 'instructors' }
            })
            .state('dashboard.manage_club.sms_students', {
                url: '/sms/students',
                controller: 'SmsController',
                templateUrl: 'views/manageclub/sms/students.html',
                controllerAs: 'vm',
                data: { screen: 'students' }
            })
            .state('dashboard.manage_club.sms_erp', {
                url: '/sms/erp',
                controller: 'SmsController',
                templateUrl: 'views/manageclub/sms/erp.html',
                controllerAs: 'vm',
                data: { screen: 'erp' }
            })
            .state('dashboard.manage_club.sms_bulletins', {
                url: '/sms/bulletins',
                controller: 'SmsController',
                templateUrl: 'views/manageclub/sms/bulletins.html',
                controllerAs: 'vm',
                data: { screen: 'bulletins' }
            })
            .state('dashboard.manage_club.sms_settings', {
                url: '/sms/settings',
                controller: 'SmsController',
                templateUrl: 'views/manageclub/sms/settings.html',
                controllerAs: 'vm',
                data: { screen: 'settings' }
            })
            .state('dashboard.manage_club.sms_audit_view', {
                url: '/sms/audit_view',
                controller: 'SmsController',
                templateUrl: 'views/manageclub/sms/audit_view.html',
                controllerAs: 'vm',
                data: { screen: 'audit_view' }
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



            .state('dashboard.manage_club.booking_slots', {
                url: '/booking_slots',
                controller: 'BookingSlotsAdminController',
                templateUrl: 'views/manageclub/booking_slots.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
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
                controller: 'InstructorScheduleController',
                templateUrl: 'views/manageuser/instructor_schedule.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })


            .state('dashboard.manage_user.instructor_holidays', {
                url: '/instructor/holidays',
                controller: 'InstructorScheduleController',
                templateUrl: 'views/manageuser/instructor_schedule.html',
                controllerAs: 'vm',
                data: {
                    action: 'list'
                }
            })


            .state('dashboard.manage_user.instructor_holidays_form', {
                url: '/instructor/holidays/add',
                controller: 'InstructorScheduleController',
                templateUrl: 'views/manageuser/instructor_schedule.html',
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


            .state('dashboard.slot_search', {
                url: '/find_a_slot',
                controller: 'SlotSearchController',
                templateUrl: 'views/bookings/slot_search.html',
                controllerAs: 'vm',
                data: {
                    action: 'search'
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

            .state('dashboard.edit_from_bookout', {
                url: '/edit_from_bookout/:booking_id',
                controller: 'Bookings2Controller',
                templateUrl: 'views/bookings/new_edit_booking.html',
                controllerAs: 'vm',
                data: {
                    action: 'edit',
                    return_to: 'bookout'
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

            // Old route kept as redirect - now handled by dashboard.edit_from_bookout
            // .state('dashboard.bookings.edit_from_bookout', { ... })

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
            controllerAs: 'vm',
            controller: 'MyAccountController'
        })

        .state('dashboard.my_account.upcoming_bookings', {
            url: '/upcoming_bookings',
            templateUrl: 'views/my_account/upcoming_bookings.html',
            controllerAs: 'vm',
            controller: 'UpcomingBookingsController'
        })

        .state('dashboard.my_account.booking_audit_trail', {
            url: '/booking_history/:booking_id',
            templateUrl: 'views/my_account/booking_audit_trail.html',
            controllerAs: 'vm',
            controller: 'BookingAuditTrailController'
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
            url: '/bookout/:booking_id/:lesson_id',
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


        // ════════════════════════════════════════════════════
        // PERSONAL LOGBOOK (verified club hours + manual entries)
        // One controller; the screen is chosen by data.screen.
        // ════════════════════════════════════════════════════
        .state('dashboard.my_account.logbook', {
            url: '/logbook',
            templateUrl: 'views/my_account/logbook/logbook.html',
            controller: 'PersonalLogbookController',
            controllerAs: 'vm',
            data: { screen: 'list' }
        })
        .state('dashboard.my_account.logbook_add', {
            url: '/logbook/add',
            templateUrl: 'views/my_account/logbook/manual_form.html',
            controller: 'PersonalLogbookController',
            controllerAs: 'vm',
            data: { screen: 'add' }
        })
        .state('dashboard.my_account.logbook_edit', {
            url: '/logbook/edit/:entry_id',
            templateUrl: 'views/my_account/logbook/manual_form.html',
            controller: 'PersonalLogbookController',
            controllerAs: 'vm',
            data: { screen: 'edit' }
        })
        .state('dashboard.my_account.logbook_stats', {
            url: '/logbook/stats',
            templateUrl: 'views/my_account/logbook/stats.html',
            controller: 'PersonalLogbookController',
            controllerAs: 'vm',
            data: { screen: 'stats' }
        })
        .state('dashboard.my_account.logbook_import', {
            url: '/logbook/import',
            templateUrl: 'views/my_account/logbook/import.html',
            controller: 'PersonalLogbookController',
            controllerAs: 'vm',
            data: { screen: 'import' }
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



        //MY VOUCHERS
        .state('dashboard.my_account.my_vouchers', {
            url: '/my_vouchers',
            templateUrl: 'views/my_account/my_vouchers.html',
            controller: 'MyVouchersController',
            controllerAs: 'vm'
        })


        // ════════════════════════════════════════════════════
        // SAFETY (SMS) — member-facing
        // SmsMemberController; the screen is chosen by data.screen.
        // ════════════════════════════════════════════════════
        .state('dashboard.my_account.sms', {
            url: '/safety',
            templateUrl: 'views/my_account/sms/home.html',
            controller: 'SmsMemberController',
            controllerAs: 'vm',
            data: { screen: 'home' }
        })
        .state('dashboard.my_account.sms_report_hazard', {
            url: '/safety/report_hazard',
            templateUrl: 'views/my_account/sms/report_hazard.html',
            controller: 'SmsMemberController',
            controllerAs: 'vm',
            data: { screen: 'report_hazard' }
        })
        .state('dashboard.my_account.sms_report_occurrence', {
            url: '/safety/report_occurrence',
            templateUrl: 'views/my_account/sms/report_occurrence.html',
            controller: 'SmsMemberController',
            controllerAs: 'vm',
            data: { screen: 'report_occurrence' }
        })
        .state('dashboard.my_account.sms_acknowledgements', {
            url: '/safety/acknowledgements',
            templateUrl: 'views/my_account/sms/acknowledgements.html',
            controller: 'SmsMemberController',
            controllerAs: 'vm',
            data: { screen: 'acknowledgements' }
        })
        .state('dashboard.my_account.sms_bulletins', {
            url: '/safety/bulletins',
            templateUrl: 'views/my_account/sms/bulletins.html',
            controller: 'SmsMemberController',
            controllerAs: 'vm',
            data: { screen: 'bulletins' }
        })


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

        .state('signup_maintenance', {
            url: '/signup/maintenance',
            templateUrl: 'views/forms/maintenance_signup/form.html',
            controller: 'MaintenanceSignupController',
            controllerAs: 'vm'
        })

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
    run.$inject = ['$rootScope', '$location', '$cookieStore', '$http', 'EnvConfig', '$state'];
    function run($rootScope, $location, $cookieStore, $http, EnvConfig, $state) {
        // keep user logged in after page refresh

        //console.log("RUNNING");

        // ── Safe back navigation ──
        // Track the previous ui-router state so we can avoid going back to login/public pages.
        var previousStateName = null;
        var previousStateParams = null;
        var publicStates = ['login', 'register', 'gallery', 'disabled', 'club_signup', 'user_signup', 'passenger_signup', 'schedule_display', 'display_pairing', 'airfield_bookout_form', 'airfield_bookout_display', 'password_reset', 'password_reset2', 'registration_success', 'registration_verification'];

        $rootScope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {
            if (fromState && fromState.name) {
                previousStateName = fromState.name;
                previousStateParams = fromParams;
            }
        });

        $rootScope.safeBack = function() {
            if (previousStateName && publicStates.indexOf(previousStateName) === -1) {
                $state.go(previousStateName, previousStateParams);
            } else {
                $state.go('dashboard');
            }
        };

        // Upload URLs — point to the API server so the PHP upload scripts
        // run on the backend where the file system is accessible.
        // ng-flow's flowCtrl looks up these overrides by the original target string.
        $rootScope.uploadTargetOverrides = {
            '/upload_documents.php': EnvConfig.getApiBaseUrl() + '/upload_documents.php',
            '/upload.php': EnvConfig.getApiBaseUrl() + '/upload.php',
            'upload.php': EnvConfig.getApiBaseUrl() + '/upload.php'
        };
        $rootScope.uploadDocumentsUrl = EnvConfig.getApiBaseUrl() + '/upload_documents.php';
        $rootScope.uploadUrl = EnvConfig.getApiBaseUrl() + '/upload.php';

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

            //check if display page
            if($location.path().indexOf("/display/") > -1){
                restrictedPage = false;
            }

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

            // Save the current path as a return destination when being redirected to /login
            // (auto-logout due to session timeout, 401, etc.). Manual logouts clear this separately.
            // Pre-auth pages a logged-out user must reach (login, all signup/invite
            // wizards, password reset, email verification, public displays/boards).
            // Matched as exact path OR prefix (path === entry || path startsWith entry + '/').
            // NB: nested authed routes like /dashboard/my_account/bookout are NOT
            // matched by '/bookout' here because the guard requires the prefix at
            // index 0 (they start with /dashboard).
            var publicPages = [
                '/login', '/register', '/gallery', '/disabled',
                '/password_reset', '/registration_success', '/registration_verification',
                '/display',
                '/club_signup',                 // club signup wizard
                '/club_signup2',                // club signup, post email-verification (token)
                '/user_signup',                 // member self-signup wizard
                '/passenger_signup',            // passenger invitation (token)
                '/passenger_signup_complete',   // returning passenger post-signup (token)
                '/invitations',                 // member invitation / BS-import conversion (token)
                '/signup/maintenance',          // maintenance organisation signup
                '/bookout',                     // public airfield book-out form (/bookout/:icao)
                '/bookout-display'              // public airfield board (token)
            ];
            var navigatingToLogin = $location.path() === '/login';
            if (navigatingToLogin && current) {
                // Extract the path portion from the full current URL
                var parser = document.createElement('a');
                parser.href = current;
                var previousPath = parser.pathname;
                // Check that the page we're leaving isn't a public page
                var isPublicOrigin = false;
                for (var p = 0; p < publicPages.length; p++) {
                    if (previousPath === publicPages[p] || previousPath.indexOf(publicPages[p] + '/') === 0) {
                        isPublicOrigin = true;
                        break;
                    }
                }
                if (!isPublicOrigin && previousPath && previousPath !== '/') {
                    try { localStorage.setItem('toaviate_return_url', previousPath); } catch(e) {}
                }
            }

            console.log(restrictedPage);

            // ── Auth redirect for logged-out users ──
            // Decide using the FULL public-pages list (the same one used above for
            // the return-url logic) rather than the narrower `restrictedPage` list,
            // so genuinely public pages (/password_reset, /display, /registration_*,
            // etc.) are never bounced to login.
            var currentPath = $location.path();
            var isPublicPage = false;
            for (var pp = 0; pp < publicPages.length; pp++) {
                if (currentPath === publicPages[pp] || currentPath.indexOf(publicPages[pp] + '/') === 0) {
                    isPublicPage = true;
                    break;
                }
            }

            var loggedIn = $rootScope.globals.currentUser && $rootScope.globals.currentUser.id;

            if (!isPublicPage && !loggedIn && !navigatingToLogin) {
                // Cancel the disallowed navigation and send the user to login.
                // - navigatingToLogin guard above means we never redirect /login -> /login.
                // - preventDefault() stops the URL from ever resolving the protected
                //   page, so this handler won't re-fire for it (no double redirect).
                // - 401s from services also send users to /login, which is public, so
                //   this guard won't bounce again from there — no redirect loop.
                event.preventDefault();
                $location.path('/login');
            } else {
                // need to expand on this with regards to access control
                // $rootScope.globals.currentUser.access_level;
            }

        });
    }