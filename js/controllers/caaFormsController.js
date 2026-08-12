// ═══════════════════════════════════════════════════════════════════
//  CaaFormsController — digital CAA paperwork (FRONTEND_CAA_FORMS_GUIDE.md).
//  One controller serves every screen, dispatched by the route's
//  data.screen (same pattern as SmsController):
//    'list'   — instructor hub: club forms / my signature queue / HoT desk.
//               The HoT tab is gated PER CLUB by the backend: hot_queue
//               returning FORBIDDEN means the user is not HoT (or deputy)
//               at that club and every HoT control stays hidden.
//    'new'    — wizard: form type → subject → prefill/eligibility review.
//    'form'   — shared form page: draft editor when editable, signing
//               view afterwards. Applicants open it too (dashboard.caa_form).
//    'member' — My Account: forms waiting for MY signature (all clubs).
// ═══════════════════════════════════════════════════════════════════

app.controller('CaaFormsController', CaaFormsController);

    CaaFormsController.$inject = ['CaaFormsService', 'InstructorService', 'MemberService', 'UserService', 'ClubService', 'ToastService',
                                  '$rootScope', '$state', '$stateParams', '$uibModal', '$q'];
    function CaaFormsController(CaaFormsService, InstructorService, MemberService, UserService, ClubService, ToastService,
                                $rootScope, $state, $stateParams, $uibModal, $q) {
        var vm = this;
        var CLUB_KEY = 'toaviate_instructor_selected_club_id';

        vm.screen = $state.current.data.screen;
        vm.user = $rootScope.globals.currentUser;
        vm.loading = true;

        // ── Shared helpers (used across screens + templates) ──
        vm.typeTitle = CaaFormsService.typeTitle;
        vm.roleLabel = function(r){ return CaaFormsService.roleLabels[r] || r; };
        vm.statusInfo = function(st){ return CaaFormsService.statuses[st] || { label: st, tone: 'muted' }; };
        vm.categoryLabel = function(c){ return CaaFormsService.categoryLabels[c] || c; };
        vm.pretty = function(str){ return str ? String(str).replace(/_/g, ' ') : ''; };
        vm.isForbidden = function(data){ return data && data.success === false && data.error === 'FORBIDDEN'; };

        // Reval training-flight suggestions: when no ENDORSED training flight
        // exists in the window, the eligibility check lists ≥1h dual flights
        // as candidates the instructor can copy into training_flight_dates.
        // Evidence panel blocks (12m window + 24m validity period), cached on
        // the eligibility object so ng-repeat sees a stable collection.
        vm.evidenceWindows = function() {
            var e = vm.eligibility;
            if (!e || !e.windows) { return []; }
            if (!e._winBlocks) {
                e._winBlocks = [];
                if (e.windows['12m']) { e._winBlocks.push({ label: 'Last 12 months', w: e.windows['12m'] }); }
                if (e.windows['24m']) { e._winBlocks.push({ label: 'Validity period (24 months)', w: e.windows['24m'] }); }
            }
            return e._winBlocks;
        };
        vm.trainingEvidence = function() {
            if (!vm.eligibility || !vm.eligibility.checks) { return null; }
            for (var i = 0; i < vm.eligibility.checks.length; i++) {
                var c = vm.eligibility.checks[i];
                if (c.id === 'training_flight') { return (c.pass && c.evidence) || null; }
            }
            return null;
        };
        vm.trainingCandidates = function() {
            if (!vm.eligibility || !vm.eligibility.checks) { return []; }
            for (var i = 0; i < vm.eligibility.checks.length; i++) {
                var c = vm.eligibility.checks[i];
                if (c.id === 'training_flight') {
                    return (!c.pass && c.candidates) || [];
                }
            }
            return [];
        };
        vm.useTrainingDate = function(date) {
            var target = (vm.screen === 'form') ? vm.formData : vm.draftFields;
            if (!target || (vm.screen === 'form' && !vm.isDraft)) { return; }
            var cur = (target.training_flight_dates || '').trim();
            if (cur.indexOf(date) > -1) { return; }   // already listed
            target.training_flight_dates = cur ? (cur + ', ' + date) : date;
            if (vm.screen === 'new') { vm.fieldsDirty = true; }
            ToastService.success('Date Copied', 'Training flight date added to the form.');
        };

        function asList(data, key) {
            if (angular.isArray(data)) { return data; }
            if (data && angular.isArray(data[key])) { return data[key]; }
            if (data && angular.isArray(data.items)) { return data.items; }
            return [];
        }

        function truthy(v) { return !!v && v !== '0' && v !== 0 && v !== 'false'; }

        function isInstructorAt(club_id) {
            var a = (vm.user.access && vm.user.access.instructor) || [];
            return a.indexOf(parseInt(club_id)) > -1 || a.indexOf(String(club_id)) > -1;
        }
        function isManagerAt(club_id) {
            var a = (vm.user.access && vm.user.access.manager) || [];
            return a.indexOf(parseInt(club_id)) > -1 || a.indexOf(String(club_id)) > -1;
        }

        function saveBlob(blob, filename) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function(){ URL.revokeObjectURL(url); }, 250);
        }

        vm.downloadPdf = function(form_id, title) {
            vm.pdfBusy = true;
            CaaFormsService.GetPdf(form_id, (title || 'caa_form') + '.pdf').then(function(res) {
                vm.pdfBusy = false;
                if (res.success === false) {
                    ToastService.error('PDF Unavailable', res.message || 'The PDF could not be generated.');
                    return;
                }
                saveBlob(res.blob, res.filename);
            });
        };

        // ── Screen dispatch ──
        switch (vm.screen) {
            case 'list':   initList();   break;
            case 'new':    initNew();    break;
            case 'form':   initForm();   break;
            case 'member': initMember(); break;
        }

        // ═════════════════════════════════════════════════════════════
        //  LIST — instructor hub (tabs: forms | queue | hot)
        // ═════════════════════════════════════════════════════════════
        function initList() {
            vm.tab = $stateParams.tab || 'forms';
            vm.clubs = [];
            vm.selected_club = null;
            vm.club_id = null;

            vm.forms = [];
            vm.queue = [];
            vm.hotQueue = [];
            vm.isHot = false;             // hot_queue answered → user is HoT/deputy HERE
            vm.hotChecked = false;
            vm.deputies = null;           // { head_of_training, deputies } when loadable
            vm.canManageDeputies = false; // principal HoT or club manager
            vm.deputyMembers = [];
            vm.newDeputy = null;
            vm.deputyBusy = false;

            vm.q = '';
            vm.statusFilter = '';
            vm.statusChips = ['draft', 'awaiting_signatures', 'awaiting_hot', 'completed', 'declined'];

            vm.setTab = function(t) {
                vm.tab = t;
                $state.go('.', { tab: t, club_id: vm.club_id }, { notify: false });
            };
            vm.setStatusFilter = function(st) { vm.statusFilter = (vm.statusFilter === st) ? '' : st; };
            vm.matchesFilters = function(f) {
                if (vm.statusFilter && f.status !== vm.statusFilter) { return false; }
                if (!vm.q) { return true; }
                var hay = ((f.subject_name || '') + ' ' + vm.typeTitle(f.form_type) + ' ' + (f.title || '')).toLowerCase();
                return hay.indexOf(vm.q.toLowerCase()) > -1;
            };

            vm.onClubSelected = function(club) {
                vm.selected_club = club;
                vm.club_id = club.id;
                try { localStorage.setItem(CLUB_KEY, String(club.id)); } catch(e) {}
                $state.go('.', { club_id: club.id, tab: vm.tab }, { notify: false });
                loadClubData();
            };

            vm.openForm = function(row) {
                $state.go('dashboard.caa_form', { id: row.form_id || row.id });
            };
            vm.newForm = function() {
                $state.go('dashboard.manage_user.caa_forms_new', { club_id: vm.club_id });
            };

            resolveClubs(function() { loadClubData(); });
        }

        function resolveClubs(done) {
            // Staff clubs = instructor OR manager OR CAA HoT/deputy — the hub
            // serves all of them (see UserService.GetStaffClubs).
            UserService.GetStaffClubs(vm.user.id).then(function(data) {
                var clubs = (data && data.clubs) || [];
                if (clubs.length > 0) {
                    vm.clubs = clubs;
                    var savedClubId = $stateParams.club_id || null;
                    try {
                        var stored = localStorage.getItem(CLUB_KEY);
                        if (savedClubId === null && stored !== null) { savedClubId = stored; }
                    } catch(e) {}
                    var selectedClub = null;
                    if (savedClubId !== null) {
                        for (var i = 0; i < vm.clubs.length; i++) {
                            if (String(vm.clubs[i].id) === String(savedClubId)) { selectedClub = vm.clubs[i]; break; }
                        }
                    }
                    if (!selectedClub) { selectedClub = vm.clubs[0]; }
                    vm.selected_club = selectedClub;
                    vm.club_id = selectedClub.id;
                    done();
                } else {
                    vm.loading = false;
                    ToastService.error('Access Error', 'You do not appear to be an instructor at any club.');
                }
            });
        }

        function loadClubData() {
            vm.loading = true;
            vm.hotChecked = false;
            vm.isHot = false;
            vm.deputies = null;
            vm.canManageDeputies = false;

            var calls = [
                CaaFormsService.List(vm.club_id),
                CaaFormsService.Queue(vm.club_id),
                CaaFormsService.HotQueue(vm.club_id)
            ];
            $q.all(calls).then(function(res) {
                vm.loading = false;
                vm.forms = asList(res[0], 'forms');
                vm.queue = asList(res[1], 'queue');

                // HoT gating: FORBIDDEN here = not HoT (nor deputy) at THIS
                // club → the whole HoT tab stays hidden for this club.
                vm.hotChecked = true;
                vm.isHot = !vm.isForbidden(res[2]) && res[2] && res[2].success !== false;
                vm.hotQueue = vm.isHot ? asList(res[2], 'queue') : [];
                if (!vm.isHot && vm.tab === 'hot') { vm.setTab('forms'); }

                if (vm.isHot) { loadDeputies(); }
            });
        }

        function loadDeputies() {
            CaaFormsService.GetDeputies(vm.club_id).then(function(data) {
                if (data.success === false) { return; }   // deputies list is a nicety — fail quiet
                vm.deputies = data;
                var principal = data.head_of_training;
                var isPrincipal = principal && String(principal.user_id) === String(vm.user.id);
                // Management = principal HoT or club manager (deputies can't nominate).
                vm.canManageDeputies = !!isPrincipal || isManagerAt(vm.club_id);
                if (vm.canManageDeputies && !vm.deputyMembers.length) {
                    MemberService.GetAllByClub(vm.club_id).then(function(members) {
                        vm.deputyMembers = angular.isArray(members) ? members : (members && members.members) || [];
                    });
                }
            });
        }

        vm.addDeputy = function() {
            if (!vm.newDeputy) {
                ToastService.warning('Pick a Member', 'Choose who to appoint as deputy Head of Training.');
                return;
            }
            vm.deputyBusy = true;
            CaaFormsService.AddDeputy(vm.club_id, vm.newDeputy.user_id || vm.newDeputy.id).then(function(data) {
                vm.deputyBusy = false;
                if (data.success === false) {
                    ToastService.error('Could Not Appoint', data.message || 'Please try again.');
                    return;
                }
                ToastService.success('Deputy Appointed', 'They can now countersign in your place.');
                vm.newDeputy = null;
                loadDeputies();
            });
        };

        vm.removeDeputy = function(dep) {
            vm.deputyBusy = true;
            CaaFormsService.RemoveDeputy(dep.id).then(function(data) {
                vm.deputyBusy = false;
                if (data.success === false) {
                    ToastService.error('Could Not Remove', data.message || 'Please try again.');
                    return;
                }
                ToastService.success('Deputy Removed', 'Their HoT access has been withdrawn.');
                loadDeputies();
            });
        };

        // ═════════════════════════════════════════════════════════════
        //  NEW — wizard: type → subject → prefill review → create draft
        // ═════════════════════════════════════════════════════════════
        function initNew() {
            vm.step = 1;
            vm.clubs = [];
            vm.selected_club = null;
            vm.club_id = null;

            vm.typeGroups = [];
            vm.form_type = null;
            vm.typeInfo = null;

            vm.members = [];
            vm.subject = null;

            vm.prefill = null;
            vm.eligibility = null;
            vm.draftFields = {};
            vm.creating = false;

            vm.onClubSelected = function(club) {
                vm.selected_club = club;
                vm.club_id = club.id;
                try { localStorage.setItem(CLUB_KEY, String(club.id)); } catch(e) {}
                vm.members = [];
                vm.subject = null;
                if (vm.step > 1) { loadMembers(); }
            };

            // Course-aware certificate prefill (caa5016/5017/5019/5020 +
            // club-branded): call 1 (no course) → identity + course picker;
            // call 2 (?course_id=) → hours computed from the course's tagged
            // training-record flights + a breakdown panel to verify against.
            vm.isCertFlow = false;
            vm.courses = [];
            vm.selectedCourse = null;
            vm.courseHours = null;      // context.course_hours breakdown
            vm.tagWarning = null;       // tagging-contract nudge text
            vm.prefillBusy = false;     // call-2 in flight
            vm.fieldsDirty = false;
            vm.pendingCourse = null;    // re-pick with unsaved edits → confirm

            vm.pickType = function(t) {
                vm.form_type = t.form_type;
                vm.typeInfo = t;
                var fam = CaaFormsService.familyOf(t.form_type);
                vm.isCertFlow = fam === 'caa_certificate' || fam === 'certificate';
                vm.step = 2;
                loadMembers();
            };

            vm.toReview = function() {
                if (!vm.subject) {
                    ToastService.warning('Pick a Member', 'Choose who this form is for.');
                    return;
                }
                vm.step = 3;
                vm.prefill = null;
                vm.eligibility = null;
                vm.courses = [];
                vm.selectedCourse = null;
                vm.courseHours = null;
                vm.tagWarning = null;
                vm.fieldsDirty = false;
                vm.pendingCourse = null;
                CaaFormsService.GetPrefill(vm.form_type, subjectId(), vm.club_id).then(function(data) {
                    if (data.success === false) {
                        ToastService.error('Prefill Failed', data.message || 'Could not load the subject\'s details.');
                        vm.step = 2;
                        return;
                    }
                    applyPrefill(data);
                    vm.courses = (data.context && data.context.courses) || [];
                });
            };

            vm.pickCourse = function(course) {
                if (vm.selectedCourse && String(vm.selectedCourse.id) === String(course.id)) { return; }
                if (vm.fieldsDirty) { vm.pendingCourse = course; return; }   // confirm first
                loadCourse(course);
            };
            vm.confirmPickCourse = function() { var c = vm.pendingCourse; vm.pendingCourse = null; loadCourse(c); };
            vm.cancelPickCourse = function() { vm.pendingCourse = null; };

            function loadCourse(course) {
                vm.prefillBusy = true;
                CaaFormsService.GetPrefill(vm.form_type, subjectId(), vm.club_id, course.id).then(function(data) {
                    vm.prefillBusy = false;
                    if (data.success === false) {
                        ToastService.error('Prefill Failed', data.message || 'Could not load the course figures.');
                        return;
                    }
                    applyPrefill(data);
                    vm.fieldsDirty = false;
                    // Stale/foreign course → course_hours null: degrade to manual.
                    if (vm.courseHours) {
                        vm.selectedCourse = course;
                    } else {
                        vm.selectedCourse = null;
                        ToastService.warning('No Course Data', 'That course has no usable records — fill the hours manually.');
                    }
                });
            }

            function subjectId() { return vm.subject.user_id || vm.subject.id; }

            vm.tagHourCount = function() {
                return (vm.courseHours && vm.courseHours.tag_hours) ? Object.keys(vm.courseHours.tag_hours).length : 0;
            };

            function applyPrefill(data) {
                vm.prefill = data;
                vm.eligibility = data.eligibility || null;
                vm.courseHours = (data.context && data.context.course_hours) || null;
                vm.draftFields = seedFields(data.fields || {});
                buildTagWarning(data);
            }

            // Seed the editable copy, typed via the form's schema (hour
            // fields become real numbers — the API wants numbers back).
            var _defCache = null;
            vm.fieldDef = function(key) {
                if (!_defCache) {
                    _defCache = {};
                    CaaFormsService.schema(vm.form_type).forEach(function(g) {
                        g.fields.forEach(function(f) { _defCache[f.key] = f; });
                    });
                }
                return _defCache[key] || null;
            };
            function seedFields(fields) {
                _defCache = null;
                var out = angular.copy(fields);
                Object.keys(out).forEach(function(k) {
                    var def = vm.fieldDef(k);
                    if (def && def.type === 'number' && out[k] !== null && out[k] !== '') {
                        out[k] = parseFloat(out[k]);
                    }
                });
                return out;
            }
            vm.fieldLabel = function(key) {
                var def = vm.fieldDef(key);
                return def ? def.label : vm.pretty(key);
            };

            // The certificate_for tick-box selector is NEVER prefilled —
            // surface it on the review screen so the instructor picks it.
            vm.certForDef = function() { return vm.isCertFlow ? vm.fieldDef('certificate_for') : null; };

            vm.sourceChip = function(key) {
                var src = vm.prefill && vm.prefill.sources && vm.prefill.sources[key];
                if (!src) { return null; }
                return {
                    users: 'profile', user_licences: 'licence',
                    user_licences_ratings: 'rating', sms_settings: 'club',
                    courses: 'course', training_records: 'records',
                    'flight_tags (night)': 'night tags',
                    'flight_tags (instrument)': 'instrument tags'
                }[src] || src;
            };

            // Tagging-contract nudge: computed hours are only as good as the
            // course's flight tags (FRONTEND_COURSE_CERTIFICATE_PREFILL_GUIDE.md).
            function buildTagWarning(data) {
                vm.tagWarning = null;
                if (!vm.courseHours) { return; }
                var srcs = data.sources || {};
                if (vm.form_type === 'caa5017' && srcs.total_flight_hours === 'training_records') {
                    vm.tagWarning = 'No night-tagged flights found on this course — the hours shown are WHOLE-COURSE totals, not at-night hours. Tag the course\'s night flights (with per-flight times where partial) for an accurate prefill.';
                }
                if (vm.form_type === 'caa5019' && (data.fields && data.fields.instrument_hours == null)) {
                    vm.tagWarning = 'No instrument-tagged flights found on this course — instrument hours could not be computed. Tag the course\'s instrument flights ("instrument" / "sole reference to instruments") for an accurate prefill.';
                }
            }

            vm.createDraft = function() {
                vm.creating = true;
                CaaFormsService.Create({
                    club_id: vm.club_id,
                    form_type: vm.form_type,
                    subject_user_id: vm.subject.user_id || vm.subject.id,
                    form_data: vm.draftFields
                }).then(function(data) {
                    vm.creating = false;
                    if (data.success === false || !data.id) {
                        ToastService.error('Could Not Create', data.message || 'Please try again.');
                        return;
                    }
                    ToastService.success('Draft Created', 'Review the details, then submit it for signatures.');
                    $state.go('dashboard.caa_form', { id: data.id });
                });
            };

            vm.back = function() {
                if (vm.step > 1) { vm.step--; return; }
                $state.go('dashboard.manage_user.caa_forms', { club_id: vm.club_id });
            };

            resolveClubs(function() { loadTypes(); });

            function loadTypes() {
                CaaFormsService.GetTypes().then(function(data) {
                    vm.loading = false;
                    if (data.success === false) {
                        ToastService.error('Could Not Load', data.message || 'The form types could not be loaded.');
                        return;
                    }
                    var types = (data && data.types) || [];
                    var byCat = {};
                    var order = [];
                    types.forEach(function(t) {
                        if (!byCat[t.category]) { byCat[t.category] = []; order.push(t.category); }
                        byCat[t.category].push(t);
                    });
                    vm.typeGroups = order.map(function(c) {
                        return { category: c, label: vm.categoryLabel(c), types: byCat[c] };
                    });
                });
            }

            function loadMembers() {
                MemberService.GetAllByClub(vm.club_id).then(function(data) {
                    vm.members = angular.isArray(data) ? data : (data && data.members) || [];
                });
            }
        }

        // ═════════════════════════════════════════════════════════════
        //  FORM — shared form page (editor when draft, signing view after)
        // ═════════════════════════════════════════════════════════════
        function initForm() {
            vm.form = null;
            vm.form_id = $stateParams.id;

            vm.isDraft = false;
            vm.canAdmin = false;         // initiator / instructor-here / HoT-here (UX gate; server authoritative)
            vm.isInstructorHere = false;
            vm.isHotHere = false;        // per-club HoT gate — hot_queue probe
            vm.isSubject = false;

            vm.schema = [];
            vm.displayGroups = [];
            vm.formData = {};
            vm.grid = null;              // dotted-item grid definition
            vm.matrix = null;            // 2128/2130 matrix definition
            vm.sectionValues = CaaFormsService.sectionValues;

            vm.eligibility = null;
            vm.saving = false;
            vm.submitting = false;
            vm.actionBusy = false;
            vm.confirmAction = null;     // 'revert' | 'cancel' — inline two-step confirm

            vm.namedSigner = null;
            vm.instructors = [];
            vm.otherRole = null;         // 'instructor' | 'examiner' — the box submit can address

            // True-copy files
            vm.fileLabel = '';
            vm.uploadBusy = false;

            load();

            function load() {
                vm.loading = true;
                CaaFormsService.Get(vm.form_id).then(function(data) {
                    vm.loading = false;
                    if (data.success === false) {
                        ToastService.error('Could Not Load', data.message || 'This form could not be loaded.');
                        return;
                    }
                    apply(data.form || data);
                });
            }

            function apply(form) {
                vm.form = form;
                vm.isDraft = form.status === 'draft';
                vm.isSubject = String(form.subject_user_id) === String(vm.user.id);
                vm.isInstructorHere = isInstructorAt(form.club_id);
                var initiatorId = form.initiated_by || form.initiator_user_id;
                var isInitiator = initiatorId && String(initiatorId) === String(vm.user.id);
                // Mirrors the backend's can_manage: initiator or HoT only
                // (probeHot upgrades it for HoT/deputies). Plain club
                // instructors get sign buttons via canSign, not admin controls.
                vm.canAdmin = !!isInitiator;

                vm.schema = CaaFormsService.schema(form.form_type);
                vm.displayGroups = CaaFormsService.displayGroups(form.form_type, form.form_data);
                vm.grid = CaaFormsService.grids[form.form_type] || null;
                vm.matrix = CaaFormsService.isMatrixType(form.form_type) ? CaaFormsService.matrix : null;
                vm.isTrueCopy = form.form_type === 'certified_true_copy';
                vm.otherRole = detectOtherRole(form);
                vm.steps = buildTimeline(form);

                if (vm.isDraft) { seedEditor(form); }

                // Per-club HoT probe — decides whether HoT controls (the HoT
                // signature box's Sign button) appear for THIS club only.
                probeHot(form);

                // Reval eligibility evidence. Submit freezes the snapshot into
                // form_data.eligibility — locked forms show that verbatim (to
                // every viewer, subject included: it's part of their form).
                // Drafts fetch LIVE eligibility (instructors only; the subject
                // viewing their own draft skips it quietly).
                if (CaaFormsService.isRevalType(form.form_type)) {
                    if (form.form_data && form.form_data.eligibility && !vm.isDraft) {
                        vm.eligibility = form.form_data.eligibility;
                    } else if (vm.isInstructorHere &&
                               (form.status === 'draft' || form.status === 'awaiting_signatures')) {
                        CaaFormsService.GetPrefill(form.form_type, form.subject_user_id, form.club_id).then(function(p) {
                            if (p.success !== false && p.eligibility) { vm.eligibility = p.eligibility; }
                        });
                    }
                }

                // Draft + submit UI: load instructors for the optional named signer.
                maybeLoadSubmitUi(form);
            }

            function maybeLoadSubmitUi(form) {
                if (!vm.isDraft || !vm.canAdmin || !vm.otherRole || vm.instructors.length) { return; }
                InstructorService.GetAllByClub(form.club_id, vm.user.id).then(function(data) {
                    vm.instructors = (data && data.instructors) || [];
                });
            }

            function probeHot(form) {
                // Always probe: the backend's can_manage is initiator-or-HoT
                // for EVERY form, not just ones with a HoT box. FORBIDDEN
                // simply means "not HoT/deputy at this club" — stay quiet.
                CaaFormsService.HotQueue(form.club_id).then(function(data) {
                    vm.isHotHere = !vm.isForbidden(data) && data && data.success !== false;
                    if (vm.isHotHere && !vm.isSubject) {
                        vm.canAdmin = true;
                        maybeLoadSubmitUi(form);
                    }
                });
            }

            function detectOtherRole(form) {
                var boxes = form.signatures || [];
                for (var i = 0; i < boxes.length; i++) {
                    if (boxes[i].role === 'instructor' || boxes[i].role === 'examiner') { return boxes[i].role; }
                }
                // Draft forms have no signature rows yet — infer from the family.
                var fam = CaaFormsService.familyOf(form.form_type);
                if (fam === 'reval' || fam === 'caa_certificate' || fam === 'certificate') { return 'instructor'; }
                if (fam === 'skill_test') { return 'examiner'; }
                return null;   // true copy: HoT only
            }

            // ── Draft editor ──
            function seedEditor(form) {
                vm.formData = angular.copy(form.form_data || {});
                // input[type=date] needs Date objects; the API speaks YYYY-MM-DD.
                vm.schema.forEach(function(group) {
                    group.fields.forEach(function(f) {
                        var v = vm.formData[f.key];
                        if (f.type === 'date' && v && angular.isString(v)) {
                            var m = moment(v, 'YYYY-MM-DD', true);
                            vm.formData[f.key] = m.isValid() ? m.toDate() : null;
                        }
                        if (f.type === 'number' && v !== undefined && v !== null && v !== '') {
                            vm.formData[f.key] = parseFloat(v);   // API decimals arrive as strings
                        }
                        if (f.type === 'bool') { vm.formData[f.key] = truthy(v); }
                    });
                });
                if (!vm.formData.sections) { vm.formData.sections = {}; }
            }

            function serializeEditor() {
                var out = angular.copy(vm.formData);
                vm.schema.forEach(function(group) {
                    group.fields.forEach(function(f) {
                        var v = out[f.key];
                        if (f.type === 'date') {
                            out[f.key] = (v && angular.isDate(v)) ? moment(v).format('YYYY-MM-DD') : (v || '');
                        }
                        if (f.type === 'bool') { out[f.key] = v ? true : false; }
                    });
                });
                // Sections: strip empties so only real marks travel.
                if (out.sections) {
                    var clean = {};
                    Object.keys(out.sections).forEach(function(k) {
                        if (out.sections[k]) { clean[k] = out.sections[k]; }
                    });
                    out.sections = clean;
                }
                return out;
            }

            vm.cycleSection = function(id) {
                if (!vm.isDraft) { return; }
                var order = ['', 'pass', 'fail', 'na'];
                var cur = vm.formData.sections[id] || '';
                var next = order[(order.indexOf(cur) + 1) % order.length];
                if (next) { vm.formData.sections[id] = next; } else { delete vm.formData.sections[id]; }
            };
            vm.setSection = function(id, val) {
                if (!vm.isDraft) { return; }
                if (vm.formData.sections[id] === val) { delete vm.formData.sections[id]; }
                else { vm.formData.sections[id] = val; }
            };
            vm.sectionOf = function(id) {
                var src = vm.isDraft ? vm.formData.sections : (vm.form.form_data && vm.form.form_data.sections);
                return (src && src[id]) || '';
            };
            // Short marks for the tight matrix cells: P / F / — / (blank).
            vm.cellMark = function(id) {
                var v = vm.sectionOf(id);
                if (v === 'pass') { return 'P'; }
                if (v === 'fail') { return 'F'; }
                if (v === 'na') { return '—'; }
                return '';
            };

            vm.saveDraft = function(silent) {
                vm.saving = true;
                return CaaFormsService.Update(vm.form_id, serializeEditor()).then(function(data) {
                    vm.saving = false;
                    if (data.success === false) {
                        ToastService.error('Could Not Save', data.message || 'Check the highlighted values and try again.');
                        return false;
                    }
                    if (!silent) { ToastService.success('Draft Saved', 'Your changes have been stored.'); }
                    return true;
                });
            };

            vm.submitForm = function() {
                vm.submitting = true;
                // Save first so what gets frozen is what's on screen.
                vm.saveDraft(true).then(function(ok) {
                    if (!ok) { vm.submitting = false; return; }
                    var payload = {};
                    if (vm.namedSigner && vm.otherRole === 'instructor') { payload.instructor_user_id = vm.namedSigner.user_id; }
                    if (vm.namedSigner && vm.otherRole === 'examiner') { payload.examiner_user_id = vm.namedSigner.user_id; }
                    CaaFormsService.Submit(vm.form_id, payload).then(function(data) {
                        vm.submitting = false;
                        if (data.success === false) {
                            ToastService.error('Could Not Submit', data.message || 'Please try again.');
                            return;
                        }
                        ToastService.success('Sent For Signatures', 'The form is now locked and signers have been emailed.');
                        load();
                    });
                });
            };

            // ── Two-step inline confirms for the destructive actions ──
            vm.askConfirm = function(what) { vm.confirmAction = what; };
            vm.cancelConfirm = function() { vm.confirmAction = null; };

            vm.revert = function() {
                vm.actionBusy = true;
                CaaFormsService.Revert(vm.form_id).then(function(data) {
                    vm.actionBusy = false;
                    vm.confirmAction = null;
                    if (data.success === false) {
                        ToastService.error('Could Not Revert', data.message || 'Please try again.');
                        return;
                    }
                    ToastService.warning('Back To Draft', 'All signatures were voided — edit and resubmit when ready.');
                    load();
                });
            };

            vm.cancelForm = function() {
                vm.actionBusy = true;
                CaaFormsService.Cancel(vm.form_id).then(function(data) {
                    vm.actionBusy = false;
                    vm.confirmAction = null;
                    if (data.success === false) {
                        ToastService.error('Could Not Cancel', data.message || 'Please try again.');
                        return;
                    }
                    ToastService.success('Form Cancelled', 'It will no longer appear in the club lists.');
                    vm.back();
                });
            };

            // ── Signing ──
            vm.canSign = function(box) {
                if (!vm.form || box.status !== 'pending' || box.is_external) { return false; }
                if (box.role === 'applicant') {
                    return vm.isSubject && vm.form.status === 'awaiting_signatures';
                }
                if (box.role === 'instructor' || box.role === 'examiner') {
                    if (vm.form.status !== 'awaiting_signatures' || vm.isSubject) { return false; }
                    if (box.signer_user_id) { return String(box.signer_user_id) === String(vm.user.id); }
                    return vm.isInstructorHere;   // unnamed box: any club instructor may claim it
                }
                if (box.role === 'hot') {
                    return vm.form.status === 'awaiting_hot' && vm.isHotHere;
                }
                return false;
            };

            vm.sign = function(box) {
                var needsOverride = box.role === 'instructor' &&
                                    CaaFormsService.isRevalType(vm.form.form_type) &&
                                    vm.eligibility && !vm.eligibility.all_pass;
                $uibModal.open({
                    templateUrl: 'views/modals/caa_sign_modal.html',
                    controller: 'CaaSignModalCtrl',
                    controllerAs: 'vm',
                    size: 'lg',
                    backdrop: 'static',
                    windowClass: 'sec-modal-window',
                    resolve: {
                        context: function() {
                            return {
                                form: vm.form,
                                box: box,
                                declaration: vm.form.declaration,
                                needsOverride: !!needsOverride
                            };
                        }
                    }
                }).result.then(function(changed) {
                    if (changed) {
                        ToastService.success('Signed', 'Your signature has been added to the form.');
                        load();
                    }
                }, function() {});
            };

            // Decline — inline expand on the signature box (transient _fields).
            vm.toggleDecline = function(box) { box._declineOpen = !box._declineOpen; };
            vm.decline = function(box) {
                box._busy = true;
                CaaFormsService.Decline(vm.form_id, { role: box.role, reason: (box._reason || '').trim() }).then(function(data) {
                    box._busy = false;
                    if (data.success === false) {
                        ToastService.error('Could Not Decline', data.message || 'Please try again.');
                        return;
                    }
                    ToastService.warning('Form Declined', 'The initiator can revert it to draft to fix and resend.');
                    load();
                });
            };

            // External signers (initiator/HoT while awaiting signatures).
            vm.canSendExternal = function(box) {
                return vm.form && vm.form.status === 'awaiting_signatures' && vm.canAdmin &&
                       box.status === 'pending' && (box.role === 'instructor' || box.role === 'examiner') &&
                       !box.is_external;
            };
            vm.sendExternal = function(box) {
                $uibModal.open({
                    templateUrl: 'views/modals/caa_external_modal.html',
                    controller: 'CaaExternalModalCtrl',
                    controllerAs: 'vm',
                    backdrop: 'static',
                    windowClass: 'sec-modal-window',
                    resolve: { context: function() { return { form: vm.form, box: box }; } }
                }).result.then(function(sent) {
                    if (sent) {
                        ToastService.success('Link Sent', 'They have 30 days to sign from the emailed link.');
                        load();
                    }
                }, function() {});
            };
            vm.resendExternal = function(box) {
                box._busy = true;
                CaaFormsService.ResendExternal(vm.form_id, box.role).then(function(data) {
                    box._busy = false;
                    if (data.success === false) {
                        ToastService.error('Could Not Resend', data.message || 'Please try again shortly.');
                        return;
                    }
                    ToastService.success('Link Resent', 'The previous link no longer works.');
                });
            };

            // ── Files (certified true copy, draft only) ──
            vm.filePicked = function(files) {
                if (!files || !files.length) { return; }
                var file = files[0];
                vm.uploadBusy = true;
                CaaFormsService.UploadFile(vm.form_id, file, vm.fileLabel).then(function(data) {
                    vm.uploadBusy = false;
                    if (data.success === false) {
                        ToastService.error('Upload Failed', data.message || 'PNG, JPG or PDF up to 20 MB.');
                        return;
                    }
                    vm.form.files = data.files || vm.form.files;
                    vm.fileLabel = '';
                    ToastService.success('Document Attached', 'It will be bound into the certified copy.');
                });
            };
            vm.previewFile = function(f) {
                f._busy = true;
                CaaFormsService.GetFile(vm.form_id, f.id).then(function(data) {
                    f._busy = false;
                    if (data.success === false || !data.data_uri) {
                        ToastService.error('Preview Failed', data.message || 'The file could not be loaded.');
                        return;
                    }
                    $uibModal.open({
                        templateUrl: 'views/modals/caa_file_preview_modal.html',
                        controller: 'CaaFilePreviewModalCtrl',
                        controllerAs: 'vm',
                        size: 'lg',
                        windowClass: 'sec-modal-window',
                        resolve: { context: function() { return { file: f, data_uri: data.data_uri }; } }
                    });
                });
            };
            vm.deleteFile = function(f) {
                if (!f._confirmDelete) { f._confirmDelete = true; return; }
                f._busy = true;
                CaaFormsService.DeleteFile(vm.form_id, f.id).then(function(data) {
                    f._busy = false;
                    if (data.success === false) {
                        ToastService.error('Could Not Remove', data.message || 'Please try again.');
                        return;
                    }
                    vm.form.files = (vm.form.files || []).filter(function(x){ return x.id !== f.id; });
                });
            };

            // ── Audit trail ──
            vm.openAudit = function() {
                $uibModal.open({
                    templateUrl: 'views/modals/caa_audit_modal.html',
                    controller: 'CaaAuditModalCtrl',
                    controllerAs: 'vm',
                    size: 'lg',
                    windowClass: 'sec-modal-window',
                    resolve: { context: function() { return { form: vm.form }; } }
                });
            };

            vm.back = function() {
                if (vm.isInstructorHere || vm.isHotHere) {
                    $state.go('dashboard.manage_user.caa_forms', { club_id: vm.form ? vm.form.club_id : null });
                } else {
                    $state.go('dashboard.my_account.caa_forms');
                }
            };

            // Progress timeline for the header (computed once per load —
            // a fresh array per digest would loop ng-repeat).
            function buildTimeline(f) {
                var hasHot = (f.signatures || []).some(function(b){ return b.role === 'hot'; }) || truthy(f.hot_countersign);
                var steps = [{ key: 'draft', label: 'Draft' }, { key: 'awaiting_signatures', label: 'Signatures' }];
                if (hasHot) { steps.push({ key: 'awaiting_hot', label: 'HoT' }); }
                steps.push({ key: 'completed', label: 'Completed' });
                var idx = steps.map(function(st){ return st.key; }).indexOf(f.status);
                steps.forEach(function(st, i) {
                    if (f.status === 'completed') { st.state = 'done'; }
                    else if (idx === -1) { st.state = 'off'; }   // declined / cancelled
                    else { st.state = i < idx ? 'done' : (i === idx ? 'active' : 'off'); }
                });
                return steps;
            }
        }

        // ═════════════════════════════════════════════════════════════
        //  MEMBER — My Account: forms waiting for MY signature
        // ═════════════════════════════════════════════════════════════
        function initMember() {
            vm.rows = [];       // boxes waiting for MY signature
            vm.myForms = [];    // my forms across clubs (history — subject access)

            ClubService.GetAllForUser(vm.user.id).then(function(data) {
                var clubs = (data && data.clubs) || [];
                if (!clubs.length) { vm.loading = false; return; }
                function tag(club) {
                    return function(rows) { rows.forEach(function(r){ r._club_title = club.title; }); return rows; };
                }
                $q.all(clubs.map(function(club) {
                    return $q.all([
                        CaaFormsService.Queue(club.id).then(function(res) {
                            return (res && res.success === false) ? [] : tag(club)(asList(res, 'queue'));
                        }),
                        CaaFormsService.List(club.id).then(function(res) {
                            return (res && res.success === false) ? [] : tag(club)(asList(res, 'forms'));
                        })
                    ]);
                })).then(function(perClub) {
                    vm.loading = false;
                    perClub.forEach(function(pair) {
                        vm.rows = vm.rows.concat(pair[0]);
                        vm.myForms = vm.myForms.concat(pair[1]);
                    });
                });
            });

            vm.openForm = function(row) {
                $state.go('dashboard.caa_form', { id: row.form_id || row.id });
            };
        }
    }

// Tiny helper so a styled label can drive a real <input type="file"> without
// scope() hacks: caa-file-input="vm.filePicked(files)".
app.directive('caaFileInput', [function() {
    return {
        restrict: 'A',
        scope: { caaFileInput: '&' },
        link: function(scope, el) {
            el.on('change', function() {
                var files = el[0].files;
                scope.$apply(function() { scope.caaFileInput({ files: files }); });
                el[0].value = '';
            });
            scope.$on('$destroy', function() { el.off('change'); });
        }
    };
}]);
