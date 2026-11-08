// ─────────────────────────────────────────────────────────────────────────
// Booked-out page helpers — views/my_account/booked_out.html (.bod-*,
// css/booked-out.css). State dashboard.my_account.booked_out.
//
//   <dd bod-countdown="vm.bookout.return" bod-fallback="vm.booking.end"></dd>
//       Live "in 1h 58m" / "due now" / "overdue by 12m" to the return time.
//       Re-rendered every 30 s ($interval, no digest), when the tab becomes
//       visible again and when either value changes; the timer is cancelled
//       on $destroy. Missing / unparseable time → empty + .bod-countdown--none.
//       Tone classes: --ok, --soon (≤ 30 min left / due now), --over (past it).
//
//   {{ vm.bookout.return | bodWhen:'time':vm.booking.end }}  "14:00"  ('' if unknown)
//   {{ vm.bookout.return | bodWhen:'day':vm.booking.end }}   ''  today | "Tomorrow" | "Sat 7 Nov"
//   {{ vm.bookout.return | bodWhen:'full':vm.booking.end }}  "14:00 on 06/11/2026" (vm.dateFormat)
//   {{ vm.booking.plane | bodPlaneModel }}                   "Piper PA-28-161" | "PA28" | ''
//   {{ hours_remaining | bodHoursTone }}                     'ok' | 'warn' | 'bad' | '' (unknown)
//       (thresholds mirror Planes::get_hours_remaining's hours_status:
//        > 5 ok, ≤ 0 red, else yellow)
//
// A time without a zone ("2026-11-06 14:00:00", the bookings table) is club
// wall-clock and is read as LOCAL time field by field — never via
// Date.parse, which older Safari rejects for the space-separated form
// (new Date(booking.end) can be an Invalid Date there; the fallback covers it).
// ─────────────────────────────────────────────────────────────────────────
app.factory('BodTime', function () {
    var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function toDate(v) {
        if (v === null || v === undefined || v === '') { return null; }
        if (Object.prototype.toString.call(v) === '[object Date]') {
            return isFinite(v.getTime()) ? v : null;
        }
        if (typeof v === 'number') {
            var dn = new Date(v);
            return isFinite(dn.getTime()) ? dn : null;
        }
        var s = String(v).replace(/^\s+|\s+$/g, '');
        var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/.exec(s);
        if (m) {
            return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
        }
        var dz = new Date(s.replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T'));   // zone-suffixed ISO etc.
        return isFinite(dz.getTime()) ? dz : null;
    }

    function pick(primary, fallback) {
        return toDate(primary) || toDate(fallback);
    }

    function sameDay(a, b) {
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    // '' for today (the tile only shows a day when it is NOT today)
    function dayLabel(d, now) {
        if (sameDay(d, now)) { return ''; }
        var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        if (sameDay(d, tomorrow)) { return 'Tomorrow'; }
        return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    }

    var NBSP = ' ';   // a narrow tile may wrap "overdue by" but never inside "1h 25m"

    function span(mins) {
        var d = Math.floor(mins / 1440);
        var h = Math.floor((mins % 1440) / 60);
        var m = mins % 60;
        if (d > 0) { return d + 'd' + (h ? NBSP + h + 'h' : ''); }
        if (h > 0) { return h + 'h' + (m ? NBSP + m + 'm' : ''); }
        return m + 'm';
    }

    // { text, tone } or null when there is no time
    function countdown(target, now) {
        if (!target) { return null; }
        var diff = target.getTime() - now.getTime();
        if (diff > 0) {
            var left = Math.ceil(diff / 60000);
            return { text: 'in' + NBSP + span(left), tone: left <= 30 ? 'soon' : 'ok' };
        }
        var over = Math.floor(-diff / 60000);
        if (over < 1) { return { text: 'due now', tone: 'soon' }; }
        return { text: 'overdue by ' + span(over), tone: 'over' };
    }

    return {
        toDate: toDate,
        pick: pick,
        dayLabel: dayLabel,
        countdown: countdown
    };
});

app.directive('bodCountdown', ['$interval', '$document', 'BodTime', function ($interval, $document, BodTime) {
    var TONES = 'bod-countdown--ok bod-countdown--soon bod-countdown--over bod-countdown--none';
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            var target = null;
            var timer = null;
            var doc = $document[0];

            element.addClass('bod-countdown');

            function render() {
                var c = BodTime.countdown(target, new Date());
                element.removeClass(TONES);
                if (!c) {
                    element.text('');
                    element.addClass('bod-countdown--none');
                    return;
                }
                element.text(c.text);
                element.addClass('bod-countdown--' + c.tone);
            }

            function stop() {
                if (timer) { $interval.cancel(timer); timer = null; }
            }

            function onVisible() {
                if (!doc.hidden) { render(); }
            }

            function current() {
                return BodTime.pick(scope.$eval(attrs.bodCountdown), attrs.bodFallback ? scope.$eval(attrs.bodFallback) : null);
            }

            // Watch the timestamp (a number), not the Date object.
            scope.$watch(function () {
                var d = current();
                return d ? d.getTime() : null;
            }, function (ms) {
                target = (ms === null) ? null : new Date(ms);
                render();
                if (target && !timer) {
                    timer = $interval(render, 30000, 0, false);   // DOM-only update: no digest needed
                } else if (!target) {
                    stop();
                }
            });

            if (doc && doc.addEventListener) {
                doc.addEventListener('visibilitychange', onVisible);
            }

            scope.$on('$destroy', function () {
                stop();
                if (doc && doc.removeEventListener) {
                    doc.removeEventListener('visibilitychange', onVisible);
                }
            });
        }
    };
}]);

app.filter('bodWhen', ['$filter', 'BodTime', function ($filter, BodTime) {
    return function (value, mode, fallback) {
        var d = BodTime.pick(value, fallback);
        if (!d) { return ''; }
        if (mode === 'day') { return BodTime.dayLabel(d, new Date()); }
        if (mode === 'full') { return $filter('date')(d, "HH:mm 'on' dd/MM/yyyy"); }
        return $filter('date')(d, 'HH:mm');
    };
}]);

app.filter('bodPlaneModel', function () {
    function clean(v) {
        return (v === null || v === undefined) ? '' : String(v).replace(/^\s+|\s+$/g, '');
    }
    return function (p) {
        if (!p) { return ''; }
        var man = clean(p.manufacturer);
        var type = clean(p.type_name);
        var out;
        if (man && type && type.toLowerCase().indexOf(man.toLowerCase()) === 0) {
            out = type;
        } else {
            out = clean(man + ' ' + type);
        }
        return out || clean(p.plane_type) || clean(p.type);
    };
});

app.filter('bodHoursTone', function () {
    return function (v) {
        if (v === null || v === undefined || v === '' || typeof v === 'boolean') { return ''; }
        var n = Number(v);
        if (!isFinite(n)) { return ''; }
        return n > 5 ? 'ok' : (n <= 0 ? 'bad' : 'warn');
    };
});
