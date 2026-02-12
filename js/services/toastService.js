// ToastService — reusable success / error / warning toast notifications
// Replaces native alert() calls with the same visual style as payment toasts.
app.factory('ToastService', ToastService);

ToastService.$inject = ['$timeout'];
function ToastService($timeout) {

    var service = {};
    service.success = showSuccess;
    service.error   = showError;
    service.warning = showWarning;
    service.validateForm = validateForm;
    service.clearFieldError = clearFieldError;
    service.highlightField = highlightField;
    return service;

    // ── Form validation helper ──
    // checks: array of { ok: <truthy condition>, field: 'element-id', label: 'Field Name' }
    // Returns true if all checks pass, false and shows toast + highlight if any fail.
    function validateForm(checks) {
        // Clear any previous highlights
        var highlighted = document.querySelectorAll('.field-error-highlight');
        for (var i = 0; i < highlighted.length; i++) {
            highlighted[i].classList.remove('field-error-highlight');
        }

        for (var j = 0; j < checks.length; j++) {
            if (!checks[j].ok) {
                var field = document.getElementById(checks[j].field);
                if (field) {
                    field.classList.add('field-error-highlight');
                    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    try { field.focus(); } catch(e) {}
                }
                showError('Missing: ' + checks[j].label,
                    'Please fill in the highlighted field before submitting.');
                return false;
            }
        }
        return true;
    }

    // ── Clear field error on focus ──
    function clearFieldError(event) {
        if (event && event.target) {
            event.target.classList.remove('field-error-highlight');
        }
        if (event && event.target) {
            var parent = event.target.closest('.field-error-highlight');
            if (parent) {
                parent.classList.remove('field-error-highlight');
            }
        }
    }

    // ── Highlight a single field by id or CSS selector + scroll into view ──
    // Returns the element (or null) for chaining.
    function highlightField(selector) {
        // Clear any previous highlights first
        var prev = document.querySelectorAll('.field-error-highlight');
        for (var i = 0; i < prev.length; i++) {
            prev[i].classList.remove('field-error-highlight');
        }
        // Try by id first, then by CSS selector
        var el = document.getElementById(selector) || document.querySelector(selector);
        if (el) {
            el.classList.add('field-error-highlight');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            try { el.focus(); } catch(e) {}
        }
        return el;
    }

    // ── Success toast (green tick + optional confetti) ──
    function showSuccess(title, subtitle, opts) {
        opts = opts || {};
        var duration = opts.duration || 3000;
        var confetti = opts.confetti !== false; // default true

        var wrapper = document.createElement('div');
        wrapper.className = 'payok-root';
        wrapper.setAttribute('role', 'status');
        wrapper.setAttribute('aria-live', 'polite');

        if (confetti) {
            var confettiEl = document.createElement('div');
            confettiEl.className = 'payok-confetti';
            for (var i = 0; i < 24; i++) {
                var piece = document.createElement('div');
                piece.className = 'payok-piece';
                piece.style.left = (Math.random() * 100) + 'vw';
                piece.style.animationDelay = (Math.random() * 150) + 'ms';
                piece.style.animationDuration = (900 + Math.random() * 600) + 'ms';
                confettiEl.appendChild(piece);
            }
            wrapper.appendChild(confettiEl);
        }

        var toast = buildToast('payok-toast', buildCheckIcon(), title, subtitle);
        wrapper.appendChild(toast);
        document.body.appendChild(wrapper);

        scheduleRemoval(wrapper, toast, 'payok-hide', duration);
    }

    // ── Error toast (red X + shake) ──
    function showError(title, subtitle, opts) {
        opts = opts || {};
        var duration = opts.duration || 5000;

        var wrapper = document.createElement('div');
        wrapper.className = 'payfail-root';
        wrapper.setAttribute('role', 'alert');
        wrapper.setAttribute('aria-live', 'assertive');

        var toast = buildToast('payfail-toast', buildXIcon(), title, subtitle);
        wrapper.appendChild(toast);
        document.body.appendChild(wrapper);

        scheduleRemoval(wrapper, toast, 'payfail-hide', duration);
    }

    // ── Warning toast (amber ⚠ icon) ──
    function showWarning(title, subtitle, opts) {
        opts = opts || {};
        var duration = opts.duration || 4000;

        var wrapper = document.createElement('div');
        wrapper.className = 'ta-warn-root';
        wrapper.setAttribute('role', 'alert');
        wrapper.setAttribute('aria-live', 'polite');

        var toast = buildToast('ta-warn-toast', buildWarnIcon(), title, subtitle);
        wrapper.appendChild(toast);
        document.body.appendChild(wrapper);

        scheduleRemoval(wrapper, toast, 'ta-warn-hide', duration);
    }

    // ── Helpers ──
    function buildToast(className, iconEl, title, subtitle) {
        var toast = document.createElement('div');
        toast.className = className;
        toast.appendChild(iconEl);

        var text = document.createElement('div');
        text.className = className.replace('-toast', '-text');

        var titleEl = document.createElement('div');
        titleEl.className = className.replace('-toast', '-title');
        titleEl.textContent = title || '';
        text.appendChild(titleEl);

        if (subtitle) {
            var subEl = document.createElement('div');
            subEl.className = className.replace('-toast', '-sub');
            subEl.textContent = subtitle;
            text.appendChild(subEl);
        }

        toast.appendChild(text);
        return toast;
    }

    function buildCheckIcon() {
        var ico = document.createElement('div');
        ico.className = 'payok-ico';
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'payok-check');
        svg.setAttribute('viewBox', '0 0 24 24');
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M5 13l4 4L19 7');
        svg.appendChild(path);
        ico.appendChild(svg);
        return ico;
    }

    function buildXIcon() {
        var ico = document.createElement('div');
        ico.className = 'payfail-ico';
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'payfail-x');
        svg.setAttribute('viewBox', '0 0 24 24');
        var p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p1.setAttribute('d', 'M6 6L18 18');
        var p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p2.setAttribute('d', 'M18 6L6 18');
        svg.appendChild(p1);
        svg.appendChild(p2);
        ico.appendChild(svg);
        return ico;
    }

    function buildWarnIcon() {
        var ico = document.createElement('div');
        ico.className = 'ta-warn-ico';
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'ta-warn-tri');
        svg.setAttribute('viewBox', '0 0 24 24');
        // triangle outline
        var p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p1.setAttribute('d', 'M12 2L1 21h22L12 2z');
        p1.setAttribute('fill', 'none');
        p1.setAttribute('stroke', '#fff');
        p1.setAttribute('stroke-width', '2');
        p1.setAttribute('stroke-linejoin', 'round');
        // exclamation line
        var p2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        p2.setAttribute('x1', '12'); p2.setAttribute('y1', '9');
        p2.setAttribute('x2', '12'); p2.setAttribute('y2', '15');
        p2.setAttribute('stroke', '#fff'); p2.setAttribute('stroke-width', '2');
        p2.setAttribute('stroke-linecap', 'round');
        // dot
        var p3 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        p3.setAttribute('cx', '12'); p3.setAttribute('cy', '18');
        p3.setAttribute('r', '1'); p3.setAttribute('fill', '#fff');
        svg.appendChild(p1); svg.appendChild(p2); svg.appendChild(p3);
        ico.appendChild(svg);
        return ico;
    }

    function scheduleRemoval(wrapper, toast, hideClass, duration) {
        $timeout(function() {
            toast.classList.add(hideClass);
            $timeout(function() {
                if (wrapper.parentNode) {
                    wrapper.parentNode.removeChild(wrapper);
                }
            }, 400);
        }, duration);
    }
}
