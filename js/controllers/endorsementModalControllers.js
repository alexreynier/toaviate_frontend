// ═══════════════════════════════════════════════════════════════════
//  Endorsement modals
//    EndorsementRequestModalCtrl   pilot → ask a club instructor to sign
//                                  a club line in-app (their queue)
//    EndorsementExternalModalCtrl  pilot → record an external endorsement
//                                  (+ optional in-person signature) and
//                                  trigger the confirmation email
//    EndorsementSignModalCtrl      instructor → sign a queued request (or
//                                  direct-sign) with the drawn signature
//  Backend contract: FRONTEND_LOGBOOK_ENDORSEMENTS_GUIDE.md
// ═══════════════════════════════════════════════════════════════════


// ═══ Request an in-app instructor signature (club lines only) ═══

app.controller('EndorsementRequestModalCtrl', EndorsementRequestModalCtrl);

EndorsementRequestModalCtrl.$inject = ['$uibModalInstance', 'LogbookEndorsementsService', 'InstructorService',
                                       'ToastService', '$rootScope', '$q', 'entry'];
function EndorsementRequestModalCtrl($uibModalInstance, LogbookEndorsementsService, InstructorService,
                                     ToastService, $rootScope, $q, entry) {
    var vm = this;

    vm.entry = entry;
    vm.loading = true;
    vm.busy = false;
    vm.instructors = [];
    vm.instructor = null;
    vm.filter = '';
    vm.note = '';

    vm.choose = function(i) { vm.instructor = i; };
    vm.clearChoice = function() { vm.instructor = null; vm.filter = ''; };
    vm.submit = submit;
    vm.cancel = function() { $uibModalInstance.dismiss('cancel'); };

    loadInstructors();

    // Prefer the flight's own club when the row carries club_id; otherwise
    // fall back to the union of instructors across all the pilot's clubs
    // (the backend re-validates the pairing anyway).
    function loadInstructors() {
        var user = $rootScope.globals.currentUser;
        var clubIds = entry.club_id ? [entry.club_id] : (user.access && user.access.pilot) || [];
        clubIds = clubIds.filter(function(id, i) { return clubIds.indexOf(id) === i; });
        if (!clubIds.length) { vm.loading = false; return; }

        $q.all(clubIds.map(function(id) { return InstructorService.GetAllByClub(id, user.id); }))
            .then(function(results) {
                vm.loading = false;
                var seen = {};
                results.forEach(function(data) {
                    ((data && data.instructors) || []).forEach(function(i) {
                        var uid = i.user_id || i.id;
                        if (uid && !seen[uid]) {
                            seen[uid] = true;
                            vm.instructors.push({
                                user_id: uid,
                                name: (i.first_name + ' ' + i.last_name),
                                initials: ((i.first_name || ' ')[0] + (i.last_name || ' ')[0]).toUpperCase()
                            });
                        }
                    });
                });
            });
    }

    function submit() {
        if (!vm.instructor) {
            ToastService.warning('Instructor Required', 'Choose the instructor who should sign this flight.');
            return;
        }
        vm.busy = true;
        LogbookEndorsementsService.Request(entry.ref_id, vm.instructor.user_id, (vm.note || '').trim())
            .then(function(data) {
                vm.busy = false;
                if (data && data.success !== false) {
                    $uibModalInstance.close(true);
                } else {
                    ToastService.error('Could Not Request', (data && data.message) || 'Please try again.');
                }
            });
    }
}


// ═══ Record an external endorsement (any line) ═══

app.controller('EndorsementExternalModalCtrl', EndorsementExternalModalCtrl);

EndorsementExternalModalCtrl.$inject = ['$uibModalInstance', 'LogbookEndorsementsService', 'ToastService', 'entry'];
function EndorsementExternalModalCtrl($uibModalInstance, LogbookEndorsementsService, ToastService, entry) {
    var vm = this;

    vm.entry = entry;
    vm.busy = false;
    vm.wordings = LogbookEndorsementsService.wordings;
    vm.form = {
        instructor_name: '',
        instructor_number: '',
        instructor_email: '',
        endorsement_text: '',
        signature_image: ''
    };
    vm.pickWording = function(w) { vm.form.endorsement_text = w; };

    vm.submit = submit;
    vm.cancel = function() { $uibModalInstance.dismiss('cancel'); };

    function submit() {
        if (!vm.form.instructor_name.trim()) {
            ToastService.highlightField('end-ext-name');
            ToastService.warning('Name Required', "Enter the instructor or examiner's full name.");
            return;
        }
        if (!vm.form.instructor_email.trim()) {
            ToastService.highlightField('end-ext-email');
            ToastService.warning('Email Required', "Enter the instructor's email — they'll confirm the endorsement from it.");
            return;
        }
        if (!vm.form.endorsement_text.trim()) {
            ToastService.highlightField('end-ext-text');
            ToastService.warning('Wording Required', 'Enter the endorsement wording (or pick a common one).');
            return;
        }

        var payload = {
            entity_type: entry.kind,
            entity_id: entry.ref_id,
            instructor_name: vm.form.instructor_name.trim(),
            instructor_number: vm.form.instructor_number.trim(),
            instructor_email: vm.form.instructor_email.trim(),
            endorsement_text: vm.form.endorsement_text.trim()
        };
        if (vm.form.signature_image) { payload.signature_image = vm.form.signature_image; }

        vm.busy = true;
        LogbookEndorsementsService.AddExternal(payload).then(function(data) {
            vm.busy = false;
            if (data && data.success) {
                $uibModalInstance.close({ saved: true });
            } else if (data && data.id) {
                // Saved, but the email failed — the caller offers Resend.
                $uibModalInstance.close({ saved: true, emailFailed: true });
            } else {
                ToastService.error('Could Not Save', (data && data.message) || 'Please try again.');
            }
        });
    }
}


// ═══ Instructor sign modal (queue request or direct) ═══
//  resolve.context: { mode:'request', id }                — sign a queued request
//                   { mode:'direct', entity_id, pilot_user_id, pilot_name } — direct
//                   plus line: {flight_date, registration, …} for the summary.

app.controller('EndorsementSignModalCtrl', EndorsementSignModalCtrl);

EndorsementSignModalCtrl.$inject = ['$uibModalInstance', 'LogbookEndorsementsService', 'ToastService',
                                    '$rootScope', 'context'];
function EndorsementSignModalCtrl($uibModalInstance, LogbookEndorsementsService, ToastService,
                                  $rootScope, context) {
    var vm = this;

    var user = $rootScope.globals.currentUser;
    vm.context = context;
    vm.busy = false;
    vm.wordings = LogbookEndorsementsService.wordings;

    var savedNumber = '';
    try { savedNumber = localStorage.getItem('toaviate_instructor_number') || ''; } catch (e) {}

    vm.stamp = {
        instructor_name: ((user.first_name || '') + ' ' + (user.last_name || '')).trim(),
        instructor_number: savedNumber,
        endorsement_text: '',
        signature_image: ''
    };
    vm.pickWording = function(w) { vm.stamp.endorsement_text = w; };

    // Saved stamp ("my signature") — when one exists, default to using it and
    // let the backend apply the image + fill blank name/number.
    vm.savedStamp = null;
    vm.useSaved = false;
    LogbookEndorsementsService.GetMySignature().then(function(data) {
        if (data && data.exists && data.signature) {
            vm.savedStamp = data.signature;
            vm.useSaved = true;
            if (!vm.stamp.instructor_number && data.signature.instructor_number) {
                vm.stamp.instructor_number = data.signature.instructor_number;
            }
        }
    });

    vm.submit = submit;
    vm.cancel = function() { $uibModalInstance.dismiss('cancel'); };

    function submit() {
        var usingSaved = !!(vm.useSaved && vm.savedStamp);
        if (!usingSaved && !vm.stamp.instructor_name.trim()) {
            ToastService.highlightField('end-sign-name');
            ToastService.warning('Name Required', 'Enter your full name as it should appear on the stamp.');
            return;
        }
        if (!vm.stamp.endorsement_text.trim()) {
            ToastService.highlightField('end-sign-text');
            ToastService.warning('Wording Required', 'Enter the endorsement wording (or pick a common one).');
            return;
        }
        if (!usingSaved && !vm.stamp.signature_image) {
            ToastService.warning('Signature Required', 'Please draw your signature in the pad.');
            return;
        }

        // The backend snapshots the number per stamp — remember it locally too.
        try { localStorage.setItem('toaviate_instructor_number', vm.stamp.instructor_number || ''); } catch (e) {}

        var stamp = {
            instructor_name: vm.stamp.instructor_name.trim(),
            instructor_number: (vm.stamp.instructor_number || '').trim(),
            endorsement_text: vm.stamp.endorsement_text.trim()
        };
        if (usingSaved) {
            // Backend applies the saved image and fills blank name/number.
            stamp.use_saved_signature = true;
        } else {
            stamp.signature_image = vm.stamp.signature_image;
        }

        vm.busy = true;
        var call = (context.mode === 'direct')
            ? LogbookEndorsementsService.SignDirect(angular.extend({}, stamp, {
                  entity_type: 'club', entity_id: context.entity_id, pilot_user_id: context.pilot_user_id }))
            : LogbookEndorsementsService.SignRequest(context.id, stamp);

        call.then(function(data) {
            vm.busy = false;
            if (data && data.success !== false) {
                $uibModalInstance.close(true);
            } else {
                ToastService.error('Could Not Sign', (data && data.message) || 'Please try again.');
            }
        });
    }
}


// ═══ Manage my stamp (saved signature) ═══

app.controller('EndorsementStampModalCtrl', EndorsementStampModalCtrl);

EndorsementStampModalCtrl.$inject = ['$uibModalInstance', 'LogbookEndorsementsService', 'ToastService', '$rootScope'];
function EndorsementStampModalCtrl($uibModalInstance, LogbookEndorsementsService, ToastService, $rootScope) {
    var vm = this;

    var user = $rootScope.globals.currentUser;
    var savedNumber = '';
    try { savedNumber = localStorage.getItem('toaviate_instructor_number') || ''; } catch (e) {}

    vm.loading = true;
    vm.busy = false;
    vm.current = null;             // {signature_image, instructor_name, instructor_number}
    vm.confirmDelete = false;
    vm.form = {
        instructor_name: ((user.first_name || '') + ' ' + (user.last_name || '')).trim(),
        instructor_number: savedNumber,
        signature_image: ''
    };

    vm.save = save;
    vm.askDelete = function() { vm.confirmDelete = true; };
    vm.cancelDelete = function() { vm.confirmDelete = false; };
    vm.remove = remove;
    vm.cancel = function() { $uibModalInstance.dismiss('cancel'); };

    LogbookEndorsementsService.GetMySignature().then(function(data) {
        vm.loading = false;
        if (data && data.exists && data.signature) {
            vm.current = data.signature;
            vm.form.instructor_name = data.signature.instructor_name || vm.form.instructor_name;
            vm.form.instructor_number = data.signature.instructor_number || vm.form.instructor_number;
        }
    });

    function save() {
        if (!vm.form.signature_image) {
            ToastService.warning('Signature Required', 'Draw your signature in the pad — it becomes your saved stamp.');
            return;
        }
        if (!vm.form.instructor_name.trim()) {
            ToastService.highlightField('stamp-name');
            ToastService.warning('Name Required', 'Enter your name as it should appear on stamps.');
            return;
        }
        vm.busy = true;
        LogbookEndorsementsService.SaveMySignature(vm.form.signature_image,
            vm.form.instructor_name.trim(), (vm.form.instructor_number || '').trim())
            .then(function(data) {
                vm.busy = false;
                if (data && data.success !== false) {
                    try { localStorage.setItem('toaviate_instructor_number', vm.form.instructor_number || ''); } catch (e) {}
                    $uibModalInstance.close(true);
                } else {
                    ToastService.error('Could Not Save Stamp', (data && data.message) || 'Please try again.');
                }
            });
    }

    function remove() {
        vm.busy = true;
        LogbookEndorsementsService.DeleteMySignature().then(function(data) {
            vm.busy = false;
            vm.confirmDelete = false;
            if (data && data.success !== false) {
                $uibModalInstance.close(true);
            } else {
                ToastService.error('Could Not Remove Stamp', (data && data.message) || 'Please try again.');
            }
        });
    }
}
