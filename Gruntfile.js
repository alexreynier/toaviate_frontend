module.exports = function (grunt) {

    // --env flag: 'development' (default), 'staging', or 'production'
    var env = grunt.option('env') || 'development';
    grunt.log.writeln('>> Building for environment: ' + env);

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
 
        clean: {

          before: { src: ["dist", '.tmp'] },
          after: { src: ["dist/js/*.js", "!dist/js/*.min.js", "dist/css/*.css", "!dist/css/*.compiled.min.css"] }


        },
 
        // copy: {
        //     main: {
        //         expand: true,
        //         cwd: '/',
        //         src: ['**', '!js/**', '!libs/**', '!**/*.css', '!node_modules/**', '!ocr_trial/**', '!bkup_nodes/**', '!api/**', '!backupanothertime/**', '!temp/**', '!upload/**'],
        //         dest: 'dist/'
        //     }
        // },

        copy: {
          main: {
            files: [
              // includes files within path
              // {expand: true, src: ['**'], dest: 'dest/', filter: 'isFile'},
              //'js/**', 'libs/**',
              // includes files within path and its sub-directories
              {expand: true, src: [ 'views/**', 'js/directives/*.html', 'js/app.js', 'images/**', 'css/**', 'favicon/**', 'index.html', 'libs/img/**', '.htaccess'], dest: 'dist/'},

              {expand: true, flatten: true, src: [ 'libs/css/fonts/**'], dest: 'dist/css/fonts'},
              {expand: true, flatten: true, src: [ 'libs/css/webfonts/**'], dest: 'dist/css/webfonts'},
              {expand: true, flatten: true, src: [ 'libs/css/images/**'], dest: 'dist/css/images'},

              // PDF.js library (kept separate from libs bundle, served from /js/ alongside other built assets)
              {expand: true, flatten: true, src: [ 'libs/js/pdf.min.js', 'libs/js/pdf.worker.min.js'], dest: 'dist/js'},


              //'libs/css/images/**', 'libs/css/fonts/**', 'libs/css/webfonts/**'

              // makes all src relative to cwd
              // {expand: true, cwd: 'path/', src: ['**'], dest: 'dest/'},

              // flattens results to a single level
              // {expand: true, flatten: true, src: ['path/**'], dest: 'dest/', filter: 'isFile'},
            ],
          },
        },

        concat: {
            options: {
              stripBanners: true,
              banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
                '<%= grunt.template.today("yyyy-mm-dd") %> */',
            },
            controllers: {
              src: ['js/controllers/*.js'],
              dest: 'dist/js/controllers.js',
            },
            directives: {
              src: ['js/directives/*.js', 'libs/js/angular-timepicker.js', 'libs/js/rangepicker.js', 'libs/js/calendar.js'],
              dest: 'dist/js/directives.js',
            },
            services: {
              src: ['js/services/*.js'],
              dest: 'dist/js/services.js',
            },
            libs: { //
                src: ['libs/js/jquery.min.js', 'libs/js/isotope.js', 'libs/js/angular.min.js', 'libs/js/angular-bootstrap.js', 'libs/js/touch.js', 'libs/js/boostrap.collapse.js', 'libs/js/ui.bootstrap.js', 'libs/js/angular-ui-route.js', 'libs/js/angular-drag-drop.js', 'libs/js/angular-cookies.js', 'libs/js/angular-toggle.js', 'libs/js/angular-edit.js', 'libs/js/typeahead.js', 'libs/js/angular-tags-input.js', 'libs/js/angular-isotope.js', 'libs/js/angular-animate.js', 'libs/js/angular-sanitize.js', 'libs/js/select.js', 'libs/js/datetime.js', 'libs/js/moment.js', 'libs/js/angular-credit-cards.js', 'libs/js/phone.js', 'libs/js/phone2.js', 'libs/js/timepicker.js', 'libs/js/datetimepicker.js', 'libs/js/slider.js', 'libs/js/daterangepicker.min.js', 'libs/js/fullcalendar.js', 'libs/js/gcal.min.js', 'libs/js/scheduler.js', 'libs/js/flow.js', 'libs/js/ng-flow.js', 'libs/js/luxon.js'],
                dest: 'dist/js/libs.js'
            },
            css: {
                // IMPORTANT: this list must stay in the SAME ORDER as the <link>
                // tags inside the build:css block in index.html. CSS cascade is
                // order-dependent — a different order here makes the compiled build
                // look different from local. Local is the source of truth for order.
                src: [
                    'libs/css/bootstrap.datetime.css',
                    'libs/css/jquery-ui.min.css',
                    'libs/css/bootstrap.min.css',
                    'libs/css/font-awesome.css',
                    'libs/css/select.css',
                    'libs/css/timepicker.css',
                    'libs/css/bootstrap-datepicker.css',
                    'libs/css/phone.css',
                    'libs/css/toggle.css',
                    'css/styles.css',
                    'css/snazzy-pages.css',
                    'libs/css/slider.css',
                    'css/calendar.css',
                    'css/instructor-schedule.css',
                    'css/slot-search.css',
                    'css/voucher-booking.css',
                    'css/schedule-display.css',
                    'css/display-pairing.css',
                    'css/voucher-widget.css',
                    'css/flight-edit.css',
                    'css/flight-merge.css',
                    'css/cancel-claim.css',
                    'css/defect-media.css',
                    'css/defect-report.css',
                    'css/experience-form.css',
                    'css/instructor-qualifications.css',
                    'css/booking-preferences.css',
                    'css/bs-sync.css',
                    'css/member-requests.css',
                    'css/airfield-bookout.css',
                    'css/club-stats.css',
                    'css/cron-status.css',
                    'css/accounting-export.css',
                    'css/fox-tracker.css',
                    'css/tracker-plane.css',
                    'css/booking-audit-trail.css',
                    'css/logbook-hours-correction.css',
                    'css/logbook-export.css',
                    'css/flight-replay.css',
                    'css/daily-aircraft-status.css',
                    'css/club-automations.css',
                    'css/maintenance-org.css',
                    'css/sms.css',
                    'css/reminders.css',
                    'css/solo-checks.css',
                    'css/payment-mode.css',
                    'css/logbook.css',
                    'css/course-content.css',
                    'css/exam-sales.css',
                    'css/tpc-import.css',
                    'css/flight-weather.css',
                    'css/airfield-admin.css',
                    'css/student-records.css',
                    'css/membership-payments.css',
                    'libs/css/scheduler.css'
                    // NOTE: css/accordion.css is deliberately NOT bundled. It is a
                    // leftover standalone-page stylesheet that carries a GLOBAL
                    // `body { padding: 24px }` rule. It isn't linked in index.html
                    // (so dev never loads it), but when it was concatenated LAST here
                    // its body rule overrode styles.css's `body { padding: 50px 0 }`
                    // in the prod bundle only — dropping the 50px top padding that
                    // clears the fixed #main_header2, so every page sat too high on
                    // built/v1 while dev looked correct. Nothing uses its
                    // `.accordionpay` classes. Leave it unbundled so prod matches dev.
                ],
                dest: 'dist/css/compiled.css'
            }
        },

        // ngAnnotate: {
        //     options: {
        //         singleQuotes: true
        //     },
        //     app: {
        //         files: {
        //             'dist/directives.ann.js': ['dist/directives.js'],
        //             'dist/controllers.ann.js': ['dist/controllers.js'],
        //             'dist/services.ann.js': ['dist/services.js']
        //         }
        //     }
        // },
        babel: { 
            options: { sourceMap: true, presets: ["@babel/preset-env"], plugins: ['angularjs-annotate'] },
            dist: {
                files: {
                    'dist/js/app.ann.js': 'dist/js/app.js',
                    'dist/js/directives.ann.js': 'dist/js/directives.js',
                    'dist/js/controllers.ann.js': 'dist/js/controllers.js',
                    'dist/js/services.ann.js': 'dist/js/services.js'
                }
            }
        },
 
        rev: {
            files: {
                src: ['dist/**/*.{js,css}', '!dist/js/shims/**', '!dist/js/pdf.min.js', '!dist/js/pdf.worker.min.js'],
                filter: function(filepath) {
                    return filepath.indexOf('pdf.min.js') === -1 && filepath.indexOf('pdf.worker.min.js') === -1;
                }
            }
        },
 
        useminPrepare: {
            html: '/index.html'
        },
 
        usemin: {
            html: ['dist/index.html']
        },

        cssmin: {
          options: {
            mergeIntoShorthands: false,
            roundingPrecision: -1
          },
          target: {
            files: {
              'dist/css/compiled.min.css': ['dist/css/compiled.css']
            }
          }
        },
        'string-replace': {
            envConfig: {
                files: {
                    'dist/js/services.js': 'dist/js/services.js'
                },
                options: {
                    replacements: [{
                        pattern: /var environment = '[^']*';/,
                        replacement: "var environment = '" + env + "';"
                    }]
                }
            },
            pdfPaths: {
                files: {
                    'dist/index.html': 'dist/index.html'
                },
                options: {
                    replacements: [{
                        pattern: 'libs/js/pdf.min.js',
                        replacement: 'js/pdf.min.js'
                    }]
                }
            }
        },

        uglify: {
            options: {
                report: 'min',
                mangle: true,
                compress: {
                    drop_console: true  // Strips all console.* calls from production builds
                }
            },
            my_target: {
                files: {
                    'dist/js/libs.min.js': ['dist/js/libs.js'],
                    'dist/js/app.min.js': ['dist/js/app.ann.js'],
                    'dist/js/controllers.min.js': ['dist/js/controllers.ann.js'],
                    'dist/js/services.min.js': ['dist/js/services.ann.js'],
                    'dist/js/directives.min.js': ['dist/js/directives.ann.js']
                }
            }
        }
    });
 
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-rev');
    grunt.loadNpmTasks('grunt-usemin');
    grunt.loadNpmTasks('grunt-babel');
    grunt.loadNpmTasks('grunt-string-replace');



    // Tell Grunt what to do when we type "grunt" into the terminal --> 
    grunt.registerTask('default', [
        'clean:before', 'copy', 'useminPrepare', 'concat', 'string-replace:envConfig', 'babel', 'cssmin', 'uglify', 'rev', 'usemin', 'string-replace:pdfPaths', 'clean:after'
    ]);

    // Convenience aliases:
    //   grunt staging    -->  grunt --env=staging
    //   grunt production -->  grunt --env=production
    grunt.registerTask('staging', 'Build for staging', function () {
        grunt.option('env', 'staging');
        grunt.config.set('string-replace.envConfig.options.replacements', [{
            pattern: /var environment = '[^']*';/,
            replacement: "var environment = 'staging';"
        }]);
        grunt.task.run('default');
    });

    grunt.registerTask('production', 'Build for production', function () {
        grunt.option('env', 'production');
        grunt.config.set('string-replace.envConfig.options.replacements', [{
            pattern: /var environment = '[^']*';/,
            replacement: "var environment = 'production';"
        }]);
        grunt.task.run('default');
    });
};