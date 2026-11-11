// TvFullscreen — the clubhouse TV's small "Full screen" control (owner, 11 Nov 2026), shared by the schedule display
// (/display/:token, ScheduleDisplayController) and the pairing page (/display/tv, DisplayPairingController).
// The Fullscreen API with the webkit prefix (old TV browsers); shown only where the browser allows it; F toggles it;
// faint until the mouse moves or it has the focus. Leaving a page never exits full screen: pairing → schedule is the
// same document, so a TV put in full screen while pairing stays in it.
app.factory('TvFullscreen', TvFullscreen);

    TvFullscreen.$inject = ['$document', '$timeout'];
    function TvFullscreen($document, $timeout) {
        var service = {};
        service.attach = attach;
        return service;

        // attach(scope, onChange) → the view's state {enabled, active, awake, toggle()}; onChange(active) after a switch
        function attach(scope, onChange) {
            var doc = $document[0], root = doc.documentElement, wakeTimer = null, lastMove = 0;
            var fs = { enabled: !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled), active: isActive(), awake: false, toggle: toggle };

            function isActive() { return !!(doc.fullscreenElement || doc.webkitFullscreenElement); }
            function settle(p) { if (p && typeof p.then === 'function') { p.then(null, function () { /* refused */ }); } }
            function toggle() {
                try {
                    if (isActive()) {
                        var exit = doc.exitFullscreen || doc.webkitExitFullscreen;
                        if (exit) { settle(exit.call(doc)); }
                    } else {
                        var req = root.requestFullscreen || root.webkitRequestFullscreen;
                        if (req) { settle(req.call(root)); }
                    }
                } catch (e) { /* the browser said no: nothing to show on a TV */ }
                wake();
            }
            function changed() {
                fs.active = isActive();
                wake();
                if (onChange) { onChange(fs.active); }
            }
            function wake() {
                fs.awake = true;
                if (wakeTimer) { $timeout.cancel(wakeTimer); }
                wakeTimer = $timeout(function () { fs.awake = false; }, 3000);
            }
            function onMove() {
                var t = new Date().getTime();
                if (t - lastMove > 400) { lastMove = t; scope.$applyAsync(wake); }
            }
            function onKey(e) {
                if (e.ctrlKey || e.metaKey || e.altKey) { return; }
                var tag = e.target && e.target.tagName ? e.target.tagName : '';
                if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) { return; }
                if (e.key === 'f' || e.key === 'F' || (!e.key && e.keyCode === 70)) {
                    if (e.preventDefault) { e.preventDefault(); }
                    scope.$applyAsync(toggle);
                }
            }
            function onChangeEvent() { scope.$applyAsync(changed); }

            if (fs.enabled) {
                doc.addEventListener('fullscreenchange', onChangeEvent);
                doc.addEventListener('webkitfullscreenchange', onChangeEvent);
                doc.addEventListener('mousemove', onMove);
                doc.addEventListener('keydown', onKey);
            }
            scope.$on('$destroy', function () {
                doc.removeEventListener('fullscreenchange', onChangeEvent);
                doc.removeEventListener('webkitfullscreenchange', onChangeEvent);
                doc.removeEventListener('mousemove', onMove);
                doc.removeEventListener('keydown', onKey);
                if (wakeTimer) { $timeout.cancel(wakeTimer); }
            });
            return fs;
        }
    }
