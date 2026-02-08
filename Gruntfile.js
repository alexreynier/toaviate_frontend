module.exports = function (grunt) {
 
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
              {expand: true, src: [ 'views/**', 'js/directives/*.html', 'js/app.js', 'images/**', 'css/**', 'index.html', 'libs/img/**', '.htaccess'], dest: 'dist/'},

              {expand: true, flatten: true, src: [ 'libs/css/fonts/**'], dest: 'dist/css/fonts'},
              {expand: true, flatten: true, src: [ 'libs/css/webfonts/**'], dest: 'dist/css/webfonts'},
              {expand: true, flatten: true, src: [ 'libs/css/images/**'], dest: 'dist/css/images'},


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
                src: ['libs/css/bootstrap.datetime.css', 'libs/css/jquery-ui.min.css', 'libs/css/bootstrap.min.css', 'libs/css/font-awesome.css', 'libs/css/select.css', 'libs/css/timepicker.css', 'libs/css/bootstrap-datepicker.css', 'libs/css/phone.css', 'libs/css/toggle.css', 'css/styles.css', 'libs/css/slider.css', 'css/calendar.css', 'libs/css/scheduler.css'],
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
                src: ['dist/**/*.{js,css}', '!dist/js/shims/**']
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
        uglify: {
            options: {
                report: 'min',
                mangle: true
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



    // Tell Grunt what to do when we type "grunt" into the terminal --> 
    grunt.registerTask('default', [
        'clean:before', 'copy', 'useminPrepare', 'concat', 'babel', 'cssmin', 'uglify', 'rev', 'usemin', 'clean:after'
    ]);
};