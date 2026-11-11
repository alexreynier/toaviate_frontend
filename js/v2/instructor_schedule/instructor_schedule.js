/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Instructor Dashboard v2 · My schedule (+ the instructor side of Suggest a time)
   Design: mockups/instructor-dashboard/my-schedule.html, page "schedule" (approved 9 Nov 2026). Built beside v1
   (views/manageuser/my_schedule.html, ReviewBookingsController) behind the global v2 switch (js/v2/core/design.js).

   State:  dashboard.v2.instructor_schedule  /manage_user/instructor/my_schedule  ← dashboard.manage_user.my_schedule
   Views:  views/v2/instructor_schedule/schedule.html (page + dialogs), _card.html (one booking card)
   CSS:    css/v2/instructor-schedule.css (msc-), on ta-base + v2/instructor.css

   Reads (be-alex-3e.md):
     GET bookings/v2/upcoming?role=instructor&include_done_today=1&days=31&per_page=200   (C38 + C44)
         bookings[] (pilot contact, briefed / debriefed, flight{…record}, voucher, offer = the taken offer that made it),
         offers[] (open | replied | taken | closed | withdrawn; ended ones listed 48 h), time_off[], summary, now.
         The server's `now` is the page clock: booking times are club wall-clock, never the device's.
     GET instructor_availability/v2/mine                       (C42) "Your hours at … today"
     Suggest a time — the times to suggest:
     GET bookings/v2/offer/{booking_id}/suggestions             (C44) a request: ranked on the server (a port of `engine` below),
                                                                each one passes the POST's busy check
     GET bookings/v2/offer/{offer_id}/times/suggestions         (C44) a released request (Change times / Suggest other times after a
                                                                reply): the same ranking from the offer's saved request, leaving out
                                                                the offer's own times. A failed read → `engine`, which also checks
                                                                "Another day or time" live, on
     GET instructor_availability/v2/preview?club_id&from&days  (C42) my bookable windows per day, time off removed
     GET scheduler/v2/day?club_id&date&days=7                  the club's aircraft + every booking on them
   Writes:
     PUT  bookings/accept_booking/{id}/{uid}                    Confirm (v1's call)
     PUT  bookings/decline_booking/{id}/{uid} {reason}          Decline (v1's call; the booking is cancelled)
     POST bookings/v2/offer/{booking_id} {times, note}          Suggest a time (the request is released)
     POST bookings/v2/offer/{offer_id}/times {times, note}      Change times / answer "asked for other times"
     DELETE bookings/v2/offer/{offer_id}?reason=                Close the request (withdraw the times; the reason goes in the
                                                                e-mail and comes back as offer.closed_note)
   Rules from alex-3e: an offer has ended by offer.state (never open_until: taken and withdrawn offers keep a future
   open_until); a REPLIED offer has every time gone until new times are sent, so it sits under "Needs your answer"
   with Suggest other times.
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider.state('dashboard.v2.instructor_schedule', {
        url: '/manage_user/instructor/my_schedule',
        templateUrl: 'views/v2/instructor_schedule/schedule.html',
        controller: 'InsScheduleV2Controller',
        controllerAs: 'vm',
        data: { action: 'list' }
    });
    DesignRoutesProvider.map('dashboard.manage_user.my_schedule', 'dashboard.v2.instructor_schedule');
}]);


/* ═════ InsScheduleV2Data — reads, writes, the row shapes and the Suggest-a-time engine (one helper per domain) ═════ */
app.factory('InsScheduleV2Data', InsScheduleV2Data);
InsScheduleV2Data.$inject = ['$q', 'InsCore', 'BookingService'];
function InsScheduleV2Data($q, InsCore, BookingService) {
    var C = InsCore;
    var KINDS = {
        dual: { ic: 'fa-user-friends', label: 'Dual lesson' }, solo: { ic: 'fa-user', label: 'Solo' }, hire: { ic: 'fa-key', label: 'Self-fly hire' },
        trial: { ic: 'fa-star', label: 'Trial lesson' }, maint: { ic: 'fa-wrench', label: 'Maintenance' }
    };
    var DOW_KEY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    var MAX_TIMES = 3;
    var s = {
        KINDS: KINDS, MAX_TIMES: MAX_TIMES,
        kindLabel: kindLabel, kindIcon: kindIcon,
        upcoming: upcoming, mine: mine, preview: preview, schedDays: schedDays, suggestions: suggestions, offerSuggestions: offerSuggestions, normSuggestion: normSuggestion,
        accept: accept, decline: decline, offer: offer, revise: revise, withdraw: withdraw,
        normBooking: normBooking, normOffer: normOffer, hhmm: hhmm, t2m: t2m, m2t: m2t, wall: wall,
        hoursToday: hoursToday, engine: engine, acWhy: acWhy
    };
    return s;

    function kindLabel(k) { return (KINDS[k] || {}).label || 'Booking'; }
    function kindIcon(k) { return (KINDS[k] || {}).ic || 'fa-circle'; }

    /* 'YYYY-MM-DD HH:MM[:SS]' → 'YYYY-MM-DD HH:MM' (club wall-clock; never through a Date) */
    function wall(v) {
        var m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(String(v || ''));
        if (m) { return m[1] + ' ' + m[2]; }
        return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v + ' 00:00' : '';
    }
    function hhmm(v) { return (String(v || '').replace('T', ' ').split(' ')[1] || '').slice(0, 5); }
    function t2m(t) { var p = String(t || '').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }
    function m2t(m) { return C.p2(Math.floor(m / 60)) + ':' + C.p2(m % 60); }

    // ── reads ─────────────────────────────────────────────────────────────────────────────────────────────────────
    /* every page of the window (per_page 200 with days; an instructor rarely has more, but never lose a booking) */
    function upcoming() {
        var all = null;
        function page(n) {
            return C.get('bookings/v2/upcoming', { role: 'instructor', include_done_today: 1, days: 31, per_page: 200, page: n }).then(function (d) {
                if (!d || d.success === false || !angular.isArray(d.bookings)) { return all ? all : (d || { success: false }); }
                if (!all) { all = d; } else { all.bookings = all.bookings.concat(d.bookings); }
                var p = d.pagination || {};
                if (p.has_more && n < 5) { return page(n + 1); }
                return all;
            });
        }
        return page(1);
    }
    function mine() { return C.get('instructor_availability/v2/mine'); }
    function suggestions(bookingId) { return C.get('bookings/v2/offer/' + bookingId + '/suggestions'); }
    function offerSuggestions(offerId) { return C.get('bookings/v2/offer/' + offerId + '/times/suggestions'); }
    /* a server suggestion → the dialog's option shape */
    function normSuggestion(x, asked) {
        var st = wall(x.start), en = wall(x.end), p = x.plane || {};
        var plane = { id: +p.id || 0, reg: p.reg || '', type: p.type || '', colour: p.colour || '', model: p.model || '' };
        var day = st.slice(0, 10), sm = t2m(hhmm(st)), em = t2m(hhmm(en));
        return { key: day + '|' + m2t(sm) + '|' + plane.reg, day: day, s: sm, e: em, plane: plane, same: x.same_aircraft != null ? !!x.same_aircraft : plane.id === +asked.id, dayOffset: x.day_offset };
    }
    function preview(clubId, from, days) { return C.get('instructor_availability/v2/preview', { club_id: clubId, from: from, days: days }); }
    /* the scheduler's day read for [from, from + days), 7 days per call */
    function schedDays(clubId, from, days) {
        var calls = [];
        for (var i = 0; i < days; i += 7) { calls.push(C.get('scheduler/v2/day', { date: C.addDays(from, i), days: 7, club_id: clubId })); }
        return $q.all(calls).then(function (list) {
            var out = { success: true, planes: [], books: [], hours: null }, seen = {};
            list.forEach(function (d) {
                if (!d || d.success === false) { out.success = false; return; }
                ((d.resources && d.resources.aircraft) || []).forEach(function (a) {
                    if (!seen['p' + a.id]) { seen['p' + a.id] = 1; out.planes.push({ id: +a.id, reg: a.reg, type: a.type || '', model: a.model || '', colour: a.colour || '', club_id: +a.club_id }); }
                });
                (d.bookings || []).forEach(function (b) {
                    if (seen['b' + b.id]) { return; }
                    seen['b' + b.id] = 1;
                    out.books.push({ id: +b.id, plane_id: +b.plane_id, instructor_id: +b.instructor_id || 0, pilot_id: +(b.pilot && b.pilot.id) || 0,
                        start: wall(b.start), end: wall(b.end), waiting: +b.waiting_list || 0 });
                });
                var cl = ((d.settings && d.settings.clubs) || []).filter(function (c) { return +c.id === +clubId; })[0];
                if (cl && cl.opening_hours) { out.hours = cl.opening_hours; }
            });
            return out;
        });
    }

    // ── writes ────────────────────────────────────────────────────────────────────────────────────────────────────
    function accept(id) { return BookingService.AcceptBooking(id, C.myId()); }
    function decline(id, reason) { var body = {}; if (reason) { body.reason = reason; } return BookingService.DeclineBooking(id, C.myId(), body); }
    function offer(bookingId, times, note) { return C.post('bookings/v2/offer/' + bookingId, { times: times, note: note || '' }); }
    function revise(offerId, times, note) { return C.post('bookings/v2/offer/' + offerId + '/times', { times: times, note: note || '' }); }
    function withdraw(offerId, reason) { return C.del('bookings/v2/offer/' + offerId, reason ? { reason: reason } : null); }

    // ── the row shapes (one for a booking, one for a released request with its offer) ─────────────────────────────
    function ac(a) { a = a || {}; return { id: +a.id || 0, reg: a.reg || '', type: a.type || '', model: a.model || '', colour: a.colour || '' }; }
    function pilot(p, student) { return p ? { id: +p.id || 0, name: p.name || '', phone: p.phone || '', email: p.email || '', student: p.student == null ? !!student : !!p.student } : null; }
    function normBooking(b) {
        var f = b.flight || {}, start = wall(b.start), end = wall(b.end);
        return {
            key: 'b' + b.id, src: 'booking', id: +b.id, club_id: +b.club_id || 0, club_name: b.club_name || '',
            start: start, end: end, day: start.slice(0, 10), mins: +b.minutes || C.minutesBetween(start, end),
            kind: KINDS[b.kind] ? b.kind : 'dual', status: b.status === 'pending' ? 'pending' : 'confirmed', pending_by: b.pending_by || null,
            can_approve: !!b.can_approve, waiting: +b.waiting_list || 0, waiting_pos: +b.waiting_position || 0,
            lesson: b.lesson && b.lesson.title ? b.lesson : null, course: b.course && b.course.title ? b.course : null,
            voucher: b.voucher && (b.voucher.code || b.voucher.id) ? b.voucher : null,
            pilot: pilot(b.pilot), ac: ac(b.aircraft), notes: b.notes || '', passengers: b.passengers || [], rental: b.rental_items || [],
            booked_by: b.booked_by || null, created_at: wall(b.created_at),
            briefed: !!b.briefed, debriefed: !!b.debriefed, complete: !!b.complete,
            flight: { sheet_id: +f.sheet_id || 0, out: !!f.booked_out, in: !!f.booked_in, out_at: wall(f.out_at), landed_at: wall(f.landed_at), record: f.record || null },
            can_book_in: !!b.can_book_in, can_book_out: !!b.can_book_out,
            solo: !!b.solo, solo_source: b.solo_source || null, offer: b.offer && b.offer.state ? normOfferPart(b.offer, b) : null
        };
    }
    function normOfferPart(o, item) {
        var asked = (item && item.aircraft) || {};
        return {
            id: +o.id, state: o.state, closed_reason: o.closed_reason || null, closed_note: o.closed_note || '', note: o.note || '', sent_at: wall(o.sent_at), open_until: wall(o.open_until),
            reply: o.reply || '', replied_at: wall(o.replied_at), taken_booking_id: +o.taken_booking_id || 0,
            times: (o.times || []).map(function (t) {
                var st = wall(t.start), en = wall(t.end), p = t.plane || {};
                return { index: +t.index, start: st, end: en, day: st.slice(0, 10), s: t2m(hhmm(st)), e: t2m(hhmm(en)), mins: +t.minutes || C.minutesBetween(st, en),
                    plane: { id: +p.id || 0, reg: p.reg || '', type: p.type || '', colour: p.colour || '', model: p.model || '' },
                    same: t.same_aircraft != null ? !!t.same_aircraft : (+p.id === +asked.id), gone: !!t.gone, state: t.state || '', closes_at: wall(t.closes_at) };
            })
        };
    }
    function normOffer(o) {
        var start = wall(o.start), end = wall(o.end);
        return {
            key: 'o' + o.offer_id, src: 'offer', oid: +o.offer_id, id: +o.booking_id, club_id: +o.club_id || 0, club_name: o.club_name || '',
            start: start, end: end, day: start.slice(0, 10), mins: +o.minutes || C.minutesBetween(start, end),
            kind: KINDS[o.kind] ? o.kind : 'dual', status: 'pending', pending_by: 'instructor', can_approve: false, waiting: 0, waiting_pos: 0,
            lesson: o.lesson && o.lesson.title ? o.lesson : null, course: o.course && o.course.title ? o.course : null, voucher: null,
            // created_at / booked_by / briefed: the released request's (asked of alex-3e, 10 Nov); shown when they come
            pilot: pilot(o.pilot, true), ac: ac(o.aircraft), notes: o.notes || '', passengers: [], rental: [], booked_by: o.booked_by || null, created_at: wall(o.created_at),
            briefed: o.briefed == null ? null : !!o.briefed, debriefed: false, complete: false, flight: { sheet_id: 0, out: false, in: false, out_at: '', landed_at: '', record: null },
            can_book_in: false, can_book_out: false, solo: !!o.solo, solo_source: o.solo ? 'lesson' : null,
            offer: normOfferPart(o.offer || {}, o), can_revise: o.can_revise !== false, can_withdraw: o.can_withdraw !== false
        };
    }

    /* the aircraft of an offered time, in words (agreed with the student side, 9 Nov):
         the one asked for · "Different aircraft · also a C152" (same type) · "Different aircraft · a PA28" (another type) */
    function acWhy(plane, same, asked, first) {
        if (same || (plane && asked && +plane.id === +asked.id)) { return { diff: false, t: 'The aircraft ' + first + ' asked for' }; }
        var t = plane && plane.type ? plane.type : '';
        if (t && asked && asked.type && t === asked.type) { return { diff: true, t: 'Different aircraft · also a ' + t }; }
        return { diff: true, t: 'Different aircraft' + (t ? ' · a ' + t : '') };
    }

    /* "Your hours at Kestrel today: 08:30–17:30" from instructor_availability/v2/mine, per club */
    function hoursToday(m, today) {
        var out = {};
        ((m && m.clubs) || []).forEach(function (c) {
            if (!c.set_up) { return; }
            var extra = (c.extra_dates || []).filter(function (x) { return x.date === today && !x.on_time_off; });
            var d = c.mode === 'adhoc' ? null : (c.days || {})[DOW_KEY[C.pd(today).getDay()]];
            var spans = [];
            if (d && d.on && d.from && d.to) { spans.push(d.from + '–' + d.to); }
            extra.forEach(function (x) { spans.push(x.from + '–' + x.to); });
            if (spans.length) { out[+c.club_id] = { name: c.name, text: spans.join(', ') }; }
        });
        return out;
    }

    /* ═════ Suggest a time: the mockup's ranking (sugList / ownCheck), on real reads ═════
       X = { b: the request row, me, now, rows: my rows (bookings + released requests), sched: { planes, books, hours },
             prev: { 'YYYY-MM-DD': [[from, to] minutes] }, setUp, timeOff }
       Free for you (your bookings, the club's bookings you teach or fly, never a time you've offered someone else), inside
       your hours (the preview's windows: time off is already out), the aircraft asked for free, else another of its type at
       the club. Best first: nearest the day and time asked for, the same aircraft before another; two a day at most. */
    function engine(X) {
        var b = X.b, L = b.mins, rd = b.day, rt = t2m(hhmm(b.start)), nowDay = X.now.slice(0, 10), nowM = t2m(hhmm(X.now));
        function abs(day, m) { var p = day.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 60000 + m; }
        function absW(w) { return abs(w.slice(0, 10), t2m(hhmm(w))); }
        function over(day, s, e, start, end) { return abs(day, s) < absW(end) && abs(day, e) > absW(start); }
        var planes = (X.sched && X.sched.planes) || [];
        // as the server's version: your waiting-list places count as busy for you; never for the aircraft
        var allBooks = ((X.sched && X.sched.books) || []).filter(function (x) { return x.id !== b.id; });
        var books = allBooks.filter(function (x) { return !x.waiting; });
        var mineAll = X.rows.filter(function (r) { return r.src === 'booking' && !r._gone && r.id !== b.id; });
        var myRows = mineAll.filter(function (r) { return !r.waiting; });
        function youBusy(day, s, e) {
            var r = mineAll.filter(function (x) { return over(day, s, e, x.start, x.end); })[0];
            if (r) { return { who: r.pilot ? r.pilot.name : 'a booking', range: hhmm(r.start) + '–' + hhmm(r.end) }; }
            var k = allBooks.filter(function (x) { return (x.instructor_id === X.me || x.pilot_id === X.me) && over(day, s, e, x.start, x.end); })[0];
            return k ? { who: 'a booking', range: hhmm(k.start) + '–' + hhmm(k.end) } : null;
        }
        function offeredTo(day, s, e) {
            return X.rows.filter(function (x) {
                return x.src === 'offer' && x.offer.state === 'open' && x.key !== b.key && !x._gone && x.offer.times.some(function (t) { return !t.gone && t.day === day && s < t.e && e > t.s; });
            })[0] || null;
        }
        var ownTimes = b.src === 'offer' && b.offer ? b.offer.times : [];
        function ownOverlap(day, s, e) { return ownTimes.some(function (t) { return t.day === day && s < t.e && e > t.s; }); }
        function planeFree(p, day, s, e) {
            if (books.some(function (x) { return x.plane_id === p.id && over(day, s, e, x.start, x.end); })) { return false; }
            return !myRows.some(function (x) { return x.ac.id === p.id && over(day, s, e, x.start, x.end); });
        }
        // an aircraft that has left the fleet (not among the club's current aircraft) is never suggested
        var asked = planes.filter(function (p) { return p.id === b.ac.id; })[0] || (planes.length ? null : { id: b.ac.id, reg: b.ac.reg, type: b.ac.type, model: b.ac.model, colour: b.ac.colour, club_id: b.club_id });
        var same = planes.filter(function (p) { return p.id !== b.ac.id && p.club_id === b.club_id && p.type && p.type === b.ac.type; });
        function pickAc(day, s, e) {
            if (asked && planeFree(asked, day, s, e)) { return { plane: asked, same: true }; }
            var alt = same.filter(function (p) { return planeFree(p, day, s, e); })[0];
            return alt ? { plane: alt, same: false } : null;
        }
        /* my hours that day: the preview's windows; a club never set up → the club's opening hours, else 08:00–18:00, so
           there is still something to suggest (the server never requires weekly hours) */
        function windows(day) {
            if (X.setUp) { return X.prev && X.prev[day] && X.prev[day].length ? X.prev[day] : null; }   // set_up is read before the days
            var oh = X.sched && X.sched.hours, iso = String(((C.pd(day).getDay() + 6) % 7) + 1);
            if (oh) { var h = oh[iso]; return h && h.open && h.close ? [[t2m(h.open), h.close === '00:00' ? 1440 : t2m(h.close)]] : null; }
            return [[480, 1080]];
        }
        function opt(day, s, e, a, extra) {
            return angular.extend({ key: day + '|' + m2t(s) + '|' + a.plane.reg, day: day, s: s, e: e, plane: a.plane, same: a.same }, extra || {});
        }
        function list() {
            var all = [];
            for (var d = -2; d <= 14; d++) {
                var day = C.addDays(rd, d), hrs = windows(day);
                if (day < nowDay || !hrs) { continue; }
                hrs.forEach(function (w) {
                    for (var t = w[0]; t + L <= w[1]; t += 30) {
                        if (day === nowDay && t < nowM + 30) { continue; }          // today: last-minute is fine, but not already under way
                        if (day === rd && t < rt + L && t + L > rt) { continue; }   // never overlapping the time you're turning down
                        if (youBusy(day, t, t + L) || offeredTo(day, t, t + L) || ownOverlap(day, t, t + L)) { continue; }
                        var a = pickAc(day, t, t + L);
                        if (a) { all.push(opt(day, t, t + L, a, { score: Math.abs(d) * 1000 + (d < 0 ? 400 : 0) + Math.abs(t - rt) + (a.same ? 0 : 250) })); }
                    }
                });
            }
            all.sort(function (x, y) { return x.score - y.score; });
            var per = {}, out = [];
            all.forEach(function (o) { var p = per[o.day] = per[o.day] || []; if (p.length < 2 && !p.some(function (q) { return Math.abs(q.s - o.s) < 90; })) { p.push(o); out.push(o); } });
            return out;
        }
        /* "Another day or time": checked as you choose → { tone: good|warn|bad, msg, opt? } */
        function check(day, time) {
            if (!day || !time) { return null; }
            var st = t2m(time), en = st + L, type = b.ac.type || 'aircraft', nm = C.firstName(b.pilot ? b.pilot.name : '') || 'the student', club = b.club_name || 'the club';
            if (day < nowDay || (day === nowDay && st <= nowM)) { return { tone: 'bad', msg: 'That time has already started. Pick a later one.' }; }
            if (day === rd && st === rt) { return { tone: 'bad', msg: 'That\'s the time ' + nm + ' asked for. To keep it, Confirm the request instead.' }; }
            var off = (X.timeOff || []).filter(function (t) { return t.all_day ? day >= t.from && day <= t.to : over(day, st, en, t.starts_at, t.ends_at); })[0];
            if (off) { return { tone: 'bad', msg: 'You\'re on time off ' + (off.all_day ? 'that day' : 'then') + (off.title ? ' (' + off.title + ')' : '') + '.' }; }
            var hit = youBusy(day, st, en);
            if (hit) { return { tone: 'bad', msg: 'You\'re teaching ' + hit.who + ' then (' + hit.range + ').' }; }
            var a = pickAc(day, st, en);
            if (!a) { return { tone: 'bad', msg: 'No ' + type + ' is free then, at ' + club + '.' }; }
            var hrs = windows(day), inside = !!(hrs && hrs.some(function (w) { return st >= w[0] && en <= w[1]; })), also = offeredTo(day, st, en);
            var msg = a.same ? 'You\'re free, and ' + b.ac.reg + ' is free.' : b.ac.reg + ' is booked then; ' + a.plane.reg + ' (also a ' + type + ') is free.';
            var shift = st - rt;
            if (day === rd && st < rt + L && en > rt) { msg = 'A shift of ' + C.len(Math.abs(shift)) + (shift > 0 ? ' later' : ' earlier') + ' than the ' + hhmm(b.start) + ' ' + nm + ' asked for. ' + msg; }
            if (!inside) { msg += ' It\'s outside your hours at ' + club + ', but you can still offer it.'; }
            if (also) { msg += ' You\'ve also offered this time to ' + C.firstName(also.pilot ? also.pilot.name : '') + ': whoever takes it first gets it.'; }
            var lead = abs(day, st) - abs(nowDay, nowM);
            if (lead < 48 * 60) { msg += ' Last-minute: it starts in ' + (lead < 24 * 60 ? C.len(Math.max(30, Math.round(lead / 30) * 30)) : 'under two days') + ', and ' + nm + ' can take it until then.'; }
            return { tone: !inside || also || !a.same ? 'warn' : 'good', msg: msg, opt: opt(day, st, en, a, { own: true }) };
        }
        return { list: list, check: check, offeredTo: offeredTo };
    }
}


/* msc-to-body: the (always present, unstyled) host of the dialogs moves to <body> while the page exists, so no transformed
   ancestor can trap the fixed scrim; the ng-ifs stay INSIDE the host (a moved ng-if block loses its end marker). ngAnimate
   is off inside it, as on the page: a closing dialog goes at once instead of waiting out its pop-in animation. */
app.directive('mscToBody', ['$animate', function ($animate) {
    return {
        restrict: 'A',
        link: function (scope, element) {
            $animate.enabled(element, false);
            document.body.appendChild(element[0]);
            scope.$on('$destroy', function () { if (element[0].parentNode) { element[0].parentNode.removeChild(element[0]); } });
        }
    };
}]);


/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   The page
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
app.controller('InsScheduleV2Controller', InsScheduleV2Controller);
InsScheduleV2Controller.$inject = ['$scope', '$state', '$timeout', '$interval', '$document', '$window', '$q', 'InsCore', 'InsScheduleV2Data', 'TaComboMatch', 'ToastService'];
function InsScheduleV2Controller($scope, $state, $timeout, $interval, $document, $window, $q, InsCore, InsScheduleV2Data, TaComboMatch, ToastService) {
    var vm = this, C = InsCore, D = InsScheduleV2Data, M = TaComboMatch;
    var QUIET = { confetti: false };
    var reduce = $window.matchMedia ? $window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var offset = 0;              // server now − device now (ms): the page clock is the club's
    var lastMin = '', seq = 0, dead = false, opener = null, schedCache = {}, prevCache = {};

    vm.load = 'loading';         // loading | ready | error
    vm.rows = [];                // bookings + released requests (open / replied offers)
    vm.ended = [];               // closed / withdrawn offers (listed 48 h) → quiet lines
    vm.takenIds = {};            // offer ids still listed (taken in the last 48 h)
    vm.timeOff = [];
    vm.hours = {};
    vm.gone = {};                // answered in this visit: key → quiet line
    vm.busy = {};                // key → true while confirming
    vm.S = { club: 0, kind: 'all', q: '', pickT: null, pickK: null, open: null, days: 7 };
    vm.cbQ = '';
    vm.cbValue = null; vm.cbSum = null;
    vm.dlg = null;               // the decline dialog
    vm.sug = null;               // the suggest dialog
    vm.V = null;                 // the built page
    vm.multiGuess = C.instructorClubs().length > 1;
    vm.skel2 = [0, 1];
    vm.skel3 = [0, 1, 2];
    vm.skel4 = [0, 1, 2, 3];
    vm.REASONS = ['I\'m not available then', 'The aircraft isn\'t right for this lesson', 'You\'re not ready for this lesson yet', 'Please book a longer slot'];

    load(true);

    /* ════════ the clock ════════ */
    function nowStr() { return C.stamp(new Date(Date.now() + offset)); }
    vm.today = function () { return nowStr().slice(0, 10); };
    var tick = $interval(function () {
        if (vm.load === 'ready' && nowStr().slice(0, 16) !== lastMin && !(vm.sug && vm.sug.busy) && !(vm.dlg && vm.dlg.busy)) { rebuild(); }
    }, 30000);
    $scope.$on('$destroy', function () { dead = true; $interval.cancel(tick); $document.off('keydown', onKey); });

    /* ════════ load ════════ */
    function load(first, quiet) {
        var my = ++seq;
        if (first) { vm.load = 'loading'; }
        return $q.all([D.upcoming(), first ? D.mine() : $q.when(null)]).then(function (res) {
            if (dead || my !== seq) { return; }
            var d = res[0];
            if (!d || d.success === false || !angular.isArray(d.bookings)) {
                if (!quiet) {
                    vm.load = 'error';
                    vm.loadMsg = (d && typeof d.message === 'string' && d.message && d.message.length < 200) ? d.message : 'The connection to ToAviate dropped. Nothing has changed — try again in a moment.';
                }
                return;
            }
            if (d.now) { offset = C.pd(d.now) - new Date(); }
            var rows = d.bookings.map(D.normBooking), ended = [], taken = {};
            (d.offers || []).forEach(function (o) {
                var st = o.offer && o.offer.state;
                if (st === 'open' || st === 'replied') { rows.push(D.normOffer(o)); }
                else if (st === 'taken') { taken[+o.offer_id] = 1; }
                else if (st === 'closed' || st === 'withdrawn') { ended.push(D.normOffer(o)); }
            });
            // keep this visit's marks across a re-read
            var keep = {};
            vm.rows.forEach(function (r) { if (r.justNow) { keep[r.key] = 1; } });
            rows.forEach(function (r) { if (keep[r.key]) { r.justNow = true; } });
            vm.rows = byStart(rows.filter(function (r) { return !vm.gone[r.key]; }));
            vm.ended = ended;
            vm.takenIds = taken;
            vm.timeOff = (d.time_off || []).map(function (t) { return { id: t.id, title: t.title || '', all_day: !!t.all_day, from: t.from, to: t.to || t.from, starts_at: D.wall(t.starts_at), ends_at: D.wall(t.ends_at) }; });
            if (res[1] && res[1].success !== false) { vm.hours = D.hoursToday(res[1], nowStr().slice(0, 10)); }
            vm.load = 'ready';
            schedCache = {}; prevCache = {};
            rebuild();
        });
    }
    function byStart(list) { return list.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id; }); }
    vm.reload = function () { load(true); };
    function quietRefresh() { $timeout(function () { if (!dead) { load(false, true); } }, 400); }

    /* ════════ one helper per domain: what a row is ════════ */
    function isReq(r) { return r.src === 'booking' && r.status === 'pending' && r.can_approve && !r.waiting; }
    function isBack(r) { return r.src === 'offer' && r.offer.state === 'replied'; }
    function isOpenOffer(r) { return r.src === 'offer' && r.offer.state === 'open'; }
    function released(r) { return r.src === 'offer'; }
    function isAsk(r) { return isReq(r) || isBack(r); }
    function liveTimes(r) { return r.offer ? r.offer.times.filter(function (t) { return !t.gone; }) : []; }
    function who(r) { return r.pilot && r.pilot.name ? r.pilot.name : 'No pilot'; }
    function first(r) { return C.firstName(who(r)); }
    /* only flight.record 'to_file' means a record is due from you (and so in your Debriefs list). alex-3e's one rule (10 Nov):
       to_file | filed | not_landed | not_required | not_needed | other_instructor, null only when there's no flight sheet */
    function toFile(r) { return r.flight.record === 'to_file'; }
    function flying(r) { return r.flight.out && !r.flight.in && !r.complete; }
    function holdsTime(r) { return !isAsk(r) && !released(r) && !r.waiting; }

    function dayWord(day) { var n = C.daysBetween(vm.today(), day); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : ''; }
    function whenShort(s) { var w = dayWord(s.slice(0, 10)); return (w ? w + ' ' : C.fDay(s) + ', ') + D.hhmm(s); }
    function asked(at) { if (!at) { return ''; } var n = C.daysBetween(at.slice(0, 10), vm.today()); return (n === 0 ? 'today' : n === 1 ? 'yesterday' : C.fDay(at)) + ' ' + D.hhmm(at); }
    function range(r) { return D.hhmm(r.start) + '–' + D.hhmm(r.end); }
    function optWhen(t) { return C.fDay(t.day) + ' · ' + D.m2t(t.s) + '–' + D.m2t(t.e); }
    vm.fDay = C.fDay; vm.hhmm = D.hhmm; vm.len = C.len; vm.plural = C.plural; vm.who = who; vm.firstOf = first; vm.range = range; vm.asked = asked;
    vm.kindLabel = D.kindLabel; vm.kindIcon = D.kindIcon; vm.m2t = D.m2t;

    /* the one status helper for this page: { tone, text, icon } */
    function status(r) {
        if (r.waiting > 0) { return { tone: 'warn', text: 'Waiting list' + (r.waiting_pos ? ' · ' + C.ord(r.waiting_pos) + ' in line' : ''), icon: 'fa-hourglass-half' }; }
        if (toFile(r)) { return { tone: 'warn', text: 'Debrief to file', icon: 'fa-clipboard' }; }
        if (r.complete) {
            if (r.debriefed || r.flight.record === 'filed') { return { tone: 'good', text: 'Debriefed', icon: 'fa-clipboard-check' }; }
            return { tone: 'good', text: r.flight.landed_at ? 'Landed ' + D.hhmm(r.flight.landed_at) : 'Booked in', icon: 'fa-plane-arrival' };
        }
        if (flying(r)) { return { tone: 'info', text: 'Flying now' + (r.flight.out_at ? ' · out at ' + D.hhmm(r.flight.out_at) : ''), icon: 'fa-plane-departure' }; }
        if (isOpenOffer(r)) { return { tone: 'pend', text: 'Waiting for ' + first(r) + ' · ' + C.plural(liveTimes(r).length, 'time') + ' offered', icon: 'fa-hourglass-half' }; }
        if (isBack(r)) { return { tone: 'warn', text: first(r) + ' asked for other times', icon: 'fa-comment' }; }
        if (r.status === 'pending') {
            if (r.can_approve) { return { tone: 'warn', text: r.pending_by === 'both' ? 'Waiting for you or the club' : 'Needs your confirmation', icon: 'fa-exclamation-circle' }; }
            return { tone: 'pend', text: r.pending_by === 'club' ? 'Awaiting club approval' : 'Awaiting approval', icon: 'fa-hourglass-half' };
        }
        if (r.offer && r.offer.state === 'taken' && (r.justNow || vm.takenIds[r.offer.id])) { return { tone: 'good', text: first(r) + ' took this time · confirmed', icon: 'fa-check' }; }
        if (r.justNow) { return { tone: 'good', text: 'Confirmed just now', icon: 'fa-check' }; }
        return { tone: 'good', text: 'Confirmed', icon: 'fa-check' };
    }

    /* ════════ scope, search, chips ════════ */
    function scoped() { var S = vm.S; return vm.rows.filter(function (r) { return !r._gone && (!S.club || r.club_id === S.club); }); }
    function wordHit(text, t) { return String(text || '').toUpperCase().split(/[\s\-()&/]+/).some(function (w) { return w && M.norm(w).indexOf(t) === 0; }); }
    function acScore(a, q) {
        var list = M.toks(q), total = 0;
        for (var i = 0; i < list.length; i++) {
            var s = M.regScore(a.reg, list[i]) || (list[i].length >= 3 && wordHit((a.type || '') + ' ' + (a.model || ''), list[i]) ? 40 : 0);
            if (!s) { return 0; }
            total += s;
        }
        return total;
    }
    function nameScore(nm, q) { var list = M.toks(q), total = 0; for (var i = 0; i < list.length; i++) { if (!wordHit(nm, list[i])) { return 0; } total += 50; } return total; }
    function pilotKey(r) { return r.pilot ? (r.pilot.id ? 'i' + r.pilot.id : 'n' + r.pilot.name) : ''; }
    function searchHit(r) {
        var S = vm.S, q = (S.q || '').trim();
        if (S.pickT === 'st') { return pilotKey(r) === S.pickK; }
        if (S.pickT === 'ac') { return r.ac.reg === S.pickK; }
        if (!q) { return true; }
        if (acScore(r.ac, q) > 0) { return true; }
        if (r.pilot && nameScore(r.pilot.name, q) > 0) { return true; }
        var list = M.toks(q);
        return list.length > 0 && list.every(function (t) { return t.length >= 3 && wordHit((r.lesson ? r.lesson.title : '') + ' ' + D.kindLabel(r.kind) + ' ' + (r.voucher ? r.voucher.code || '' : ''), t); });
    }
    function filtering() { var S = vm.S; return !!(S.pickT || (S.q || '').trim() || S.kind !== 'all'); }

    /* the search menu (<ta-combo>, picker B): students and aircraft on your schedule, ranked the way pilots talk */
    vm.cbSource = function (q) {
        q = String(q || '').trim();
        var S = vm.S, today = vm.today(), now = nowStr(), L = scoped().filter(function (r) { return r.day >= today; });
        var st = {}, sk = [], ac = {}, ak = [];
        L.forEach(function (r) {
            if (r.pilot) { var k = pilotKey(r); if (!st[k]) { st[k] = { key: k, name: r.pilot.name, n: 0, next: null }; sk.push(k); } st[k].n++; if (!st[k].next && r.end > now) { st[k].next = r; } }
            if (!ac[r.ac.reg]) { ac[r.ac.reg] = { a: r.ac, n: 0, next: null, club: r.club_name }; ak.push(r.ac.reg); }
            ac[r.ac.reg].n++; if (!ac[r.ac.reg].next && r.end > now) { ac[r.ac.reg].next = r; }
        });
        var sts = sk.map(function (k) { return st[k]; }), acs = ak.map(function (k) { return ac[k]; });
        function nextKey(x) { return x.next ? x.next.start : 'z'; }
        function byNext(a, b) { return nextKey(a) < nextKey(b) ? -1 : nextKey(a) > nextKey(b) ? 1 : 0; }
        function stRow(x) {
            var nb = x.next;
            return { key: 'st:' + x.key, av: { member: true, title: 'Member' }, t: x.name, noHlSub: true,
                s: nb ? 'Next ' + whenShort(nb.start) + ' · ' + (nb.lesson ? nb.lesson.title : D.kindLabel(nb.kind)) : 'No more bookings this month',
                r: C.plural(x.n, 'booking'), on: S.pickT === 'st' && S.pickK === x.key };
        }
        function acRow(x) {
            return { key: 'ac:' + x.a.reg, ac: x.a.colour || undefined, t: x.a.reg, s: (x.a.model || x.a.type) + (x.club ? ' · ' + x.club : ''),
                r: C.plural(x.n, 'booking'), rs: x.next ? 'next ' + whenShort(x.next.start) : '', on: S.pickT === 'ac' && S.pickK === x.a.reg };
        }
        var groups = [];
        if (!q) {
            sts.sort(byNext);
            acs.sort(function (a, b) { return b.n - a.n || (a.a.reg < b.a.reg ? -1 : 1); });
            groups.push({ label: 'Students up next', right: C.plural(sts.length, 'student') + ' on your schedule', rows: sts.slice(0, 5).map(stRow) });
            groups.push({ label: 'Aircraft you fly most', right: C.plural(acs.length, 'aircraft', 'aircraft'), rows: acs.slice(0, 4).map(acRow) });
        } else {
            var aHits = acs.filter(function (x) { return acScore(x.a, q) > 0; }).sort(function (a, b) { return acScore(b.a, q) - acScore(a.a, q) || b.n - a.n; });
            var sHits = sts.filter(function (x) { return nameScore(x.name, q) > 0; }).sort(byNext);
            if (aHits.length) { groups.push({ label: 'Aircraft', right: C.plural(aHits.length, 'match', 'matches'), rows: aHits.slice(0, 6).map(acRow) }); }
            if (sHits.length) { groups.push({ label: 'Students', right: C.plural(sHits.length, 'match', 'matches'), rows: sHits.slice(0, 6).map(stRow) }); }
        }
        var hits = q ? scoped().filter(searchHit).length : 0;
        return {
            groups: groups,
            empty: { t: 'Nothing on your schedule matches “' + q + '”', s: 'Try the last two letters of a registration (BA finds G-SHBA) or a student\'s first name.' },
            foot: q ? C.plural(hits, 'booking') + ' match “' + q + '” — the list below is already filtered' : ''
        };
    };
    vm.cbType = function (q) { var S = vm.S; S.q = q || ''; S.pickT = null; S.pickK = null; S.open = null; rebuild(); };
    vm.cbLeave = function (q) { vm.S.q = q || ''; rebuild(); };
    vm.cbPick = function (key) {
        var S = vm.S, i = key.indexOf(':');
        S.pickT = key.slice(0, i); S.pickK = key.slice(i + 1); S.q = ''; S.open = null; S.kind = 'all';
        rebuild();
    };
    vm.cbClear = function () { var S = vm.S; S.q = ''; S.pickT = null; S.pickK = null; S.open = null; vm.cbQ = ''; rebuild(); };
    vm.cbOpen = function () { return !!document.querySelector('.msc-tools .ta-combo--open'); };
    // Esc / Cancel in the search empty what was typed (the directive clears its query): the list follows
    $scope.$watch(function () { return vm.cbQ; }, function (v, old) { if (v !== old && (v || '') !== (vm.S.q || '') && !vm.S.pickT) { vm.S.q = v || ''; rebuild(); } });
    function setPicked() {
        var S = vm.S, v = null, sum = null;
        if (S.pickT) {
            var m = scoped().filter(searchHit), r0 = m[0];
            if (S.pickT === 'st' && r0) { v = { av: { member: true, title: 'Member' }, name: r0.pilot.name }; }
            if (S.pickT === 'ac' && r0) { v = { ac: { reg: r0.ac.reg, type: r0.ac.type, colour: r0.ac.colour, title: r0.ac.reg + (r0.ac.model ? ' · ' + r0.ac.model : '') } }; }
            var nx = m.filter(function (r) { return r.end > nowStr(); })[0] || r0;
            sum = { b: C.plural(m.length, 'booking'), post: nx ? ' · next ' + whenShort(nx.start) : '' };
        }
        if (!angular.equals(v, vm.cbValue)) { vm.cbValue = v; }
        if (!angular.equals(sum, vm.cbSum)) { vm.cbSum = sum; }
    }

    vm.setClub = function (id) {
        var S = vm.S; S.club = id; S.open = null;
        if (S.pickT === 'ac' && !scoped().some(function (r) { return r.ac.reg === S.pickK; })) { S.pickT = null; S.pickK = null; }
        rebuild();
    };
    vm.setKind = function (k) {
        var S = vm.S; S.kind = S.kind === k && k !== 'all' ? 'all' : k; S.open = null; rebuild();
        if (k === 'confirm') { $timeout(function () { var el = document.getElementById('msc-asks'); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'start', behavior: smooth() }); } }, 30, false); }
    };
    vm.toggle = function (r) { vm.S.open = vm.S.open === r.key ? null : r.key; };
    vm.more = function () { vm.S.days = Math.min(30, vm.S.days + 7); rebuild(); };
    function smooth() { return reduce && reduce.matches ? 'auto' : 'smooth'; }

    /* ════════ build the page (the mockup's page(), as view objects) ════════ */
    function rebuild() {
        if (vm.load !== 'ready') { return; }
        var S = vm.S, now = nowStr(), today = now.slice(0, 10), filt = filtering();
        lastMin = now.slice(0, 16);
        var clubs = {}, clubList = [];
        vm.rows.concat(vm.ended).forEach(function (r) {
            if (r.club_id && !clubs[r.club_id]) { clubs[r.club_id] = { id: r.club_id, name: r.club_name, n: 0 }; clubList.push(clubs[r.club_id]); }
            if (clubs[r.club_id]) { clubs[r.club_id].n++; }
        });
        var home = (clubList.slice().sort(function (a, b) { return b.n - a.n; })[0] || {}).id;
        var V = { clubs: clubList, multi: clubList.length > 1, any: vm.rows.length > 0 || vm.ended.length > 0 || Object.keys(vm.gone).length > 0 };
        V.allLabel = clubList.length === 2 ? 'Both clubs' : 'All clubs';
        V.sub = V.multi ? 'The lessons you\'re teaching at ' + (clubList.length === 2 ? 'both' : 'all your') + ' clubs, and the students waiting for your answer' : 'The lessons you\'re teaching, and the students waiting for your answer';

        var L = scoped(), live = L.filter(holdsTime);
        /* tiles: next up · to confirm · today · next 30 days (phones keep the first two) */
        var T = {}, todayLive = live.filter(function (r) { return r.day === today; });
        var next = live.filter(function (r) { return r.start > now && !r.complete; })[0];
        var asksAll = L.filter(isAsk);
        if (next) {
            var m = C.minutesBetween(now, next.start);
            T.next = { v: whenShort(next.start) + (m < 24 * 60 ? ' · in ' + C.len(m) : ''), s: who(next) + ' · ' + next.ac.reg + ' · ' + (next.lesson ? next.lesson.title : D.kindLabel(next.kind)) };
        }
        if (asksAll.length) {
            var oldest = asksAll.map(function (r) { return isBack(r) ? r.offer.replied_at : r.created_at; }).filter(Boolean).sort()[0];
            T.attn = { v: asksAll.length, s: (asksAll.length === 1 ? 'student is' : 'students are') + ' waiting for your yes or no' + (oldest ? ' — the oldest asked ' + asked(oldest) : ''), go: 'Answer ' + (asksAll.length === 1 ? 'it' : 'them') };
        }
        var tm = todayLive.reduce(function (s, r) { return s + r.mins; }, 0), deb = todayLive.filter(toFile).length;
        T.today = { v: C.plural(todayLive.length, 'flight'), s: todayLive.length ? D.hhmm(todayLive[0].start) + '–' + D.hhmm(todayLive[todayLive.length - 1].end) + ' · ' + C.len(tm) + ' booked' + (deb ? ' · ' + C.plural(deb, 'debrief') + ' to file' : '') : 'Nothing booked with you today' };
        var month = live.filter(function (r) { return r.start >= now || r.day === today; }), ppl = {};
        month.forEach(function (r) { if (r.pilot) { ppl[pilotKey(r)] = 1; } });
        T.month = { v: month.length, s: 'bookings with ' + C.plural(Object.keys(ppl).length, 'person', 'people') + ' · ' + C.len(month.reduce(function (s, r) { return s + r.mins; }, 0)) + ' booked (not flight time)' };
        V.t = T;

        /* chips */
        var base = L.filter(searchHit), n = { all: base.length, confirm: base.filter(isAsk).length };
        ['dual', 'solo', 'trial'].forEach(function (k) { n[k] = base.filter(function (r) { return r.kind === k; }).length; });
        var chips = [{ k: 'all', t: 'All', n: n.all }];
        if (n.confirm) { chips.push({ k: 'confirm', t: 'To confirm', n: n.confirm, attn: true }); }
        [['dual', 'Dual'], ['solo', 'Solo'], ['trial', 'Trial lessons']].forEach(function (k) { if (n[k[0]]) { chips.push({ k: k[0], t: k[1], n: n[k[0]], ic: D.kindIcon(k[0]) }); } });
        V.chips = chips;
        V.found = (S.pickT || (S.q && S.q.trim())) ? { n: C.plural(base.length, 'booking'), how: S.pickT === 'st' ? 'with' : S.pickT === 'ac' ? 'in' : 'matching',
            what: S.pickT ? (S.pickT === 'st' ? (base[0] && base[0].pilot ? base[0].pilot.name : '') : S.pickK) : '“' + S.q.trim() + '”', typed: !S.pickT } : null;

        var vis = L.filter(function (r) { return searchHit(r) && (S.kind === 'all' || (S.kind === 'confirm' ? isAsk(r) : r.kind === S.kind)); });
        var asks = vis.filter(isAsk), waits = vis.filter(isOpenOffer), rest = vis.filter(function (r) { return !isAsk(r) && !isOpenOffer(r); });
        function card(r, o) { return cardVm(r, o || {}, S.club === 0 && V.multi && r.club_id !== home); }

        /* 1 · needs your answer (+ answered in this visit, + offers that ended in the last 48 h) */
        var ghosts = Object.keys(vm.gone).map(function (k) { return vm.gone[k]; });
        vm.ended.forEach(function (r) { if (!vm.gone[r.key] && (!S.club || r.club_id === S.club)) { ghosts.push(endedGhost(r)); } });
        V.asks = asks.map(function (r) { return card(r, { day: true }); });
        V.ghosts = filt ? [] : ghosts;
        V.showAsks = asks.length > 0 || (ghosts.length > 0 && !filt);
        V.waits = waits.map(function (r) { return card(r, { day: true }); });
        V.confirmOnly = S.kind === 'confirm';

        /* 2 · today, with the now line and the free time between bookings */
        var tr = rest.filter(function (r) { return r.day === today; }), items = [], drawn = false;
        var nextKey = (tr.filter(function (r) { return r.start > now && !r.complete && !flying(r) && r.status === 'confirmed' && !r.waiting; })[0] || {}).key;
        function nowLine(at) { if (!drawn && at > now) { drawn = true; items.push({ t: 'now', key: 'now', at: D.hhmm(now) }); } }
        tr.forEach(function (r, i) {
            nowLine(r.start);
            items.push(angular.extend(card(r, { next: r.key === nextKey }), { t: 'card', key: r.key }));
            var nb = tr[i + 1];
            if (nb && !filt) {
                var gap = C.minutesBetween(r.end, nb.start);
                if (gap >= 60 && nb.start > now) {
                    nowLine(r.end);
                    var at = r.end > now ? r.end : now;
                    items.push({ t: 'gap', key: 'gap' + r.key, txt: 'Free ' + D.hhmm(r.end) + '–' + D.hhmm(nb.start) + ' · ' + C.len(gap), at: at, mins: C.minutesBetween(at, nb.start) });
                }
            }
        });
        if (tr.length && !drawn) { items.push({ t: 'now', key: 'now', at: D.hhmm(now) }); }
        var hrs = Object.keys(vm.hours).filter(function (id) { return !S.club || +id === S.club; }).map(function (id) { return 'Your hours at ' + vm.hours[id].name + ' today: ' + vm.hours[id].text; });
        V.today = { show: tr.length > 0 || !filt, label: 'Today · ' + C.fDay(today), items: items,
            sub: (hrs.length ? hrs.join(' · ') + ' · ' : '') + C.plural(tr.length, 'booking') + (tr.length ? ' · ' + C.len(tr.reduce(function (s, r) { return s + r.mins; }, 0)) + ' booked' : '') };

        /* 3 · coming up, a week at a time */
        var later = rest.filter(function (r) { return r.day > today; });
        var until = filt ? C.addDays(today, 30) : C.addDays(today, S.days);
        var shown = later.filter(function (r) { return r.day <= until; }), hidden = later.length - shown.length;
        var days = {}, order = [];
        shown.forEach(function (r) { if (!days[r.day]) { days[r.day] = []; order.push(r.day); } days[r.day].push({ t: 'card', key: r.key, r: r, start: r.start }); });
        if (!filt) {
            vm.timeOff.forEach(function (t) { if (t.from > today && t.from <= until && !days[t.from]) { days[t.from] = []; order.push(t.from); } });
            // the times you've offered sit in their day, dashed, so you don't give them to someone else
            L.filter(isOpenOffer).forEach(function (r) {
                liveTimes(r).forEach(function (t) {
                    if (t.day <= today || t.day > until) { return; }
                    if (!days[t.day]) { days[t.day] = []; order.push(t.day); }
                    days[t.day].push({ t: 'held', key: 'h' + r.key + '-' + t.index, start: t.start,
                        h: { time: D.m2t(t.s) + '–' + D.m2t(t.e), colour: t.plane.colour, txt: 'Offered to ' + who(r) + ' · ' + t.plane.reg + ' · not booked until ' + first(r) + ' takes it' } });
                });
            });
            order.sort();
            order.forEach(function (d) { days[d].sort(function (x, y) { return x.start < y.start ? -1 : x.start > y.start ? 1 : 0; }); });
        }
        V.days = order.map(function (d) {
            var list = days[d], real = list.filter(function (x) { return x.t === 'card'; }), w = dayWord(d);
            var off = vm.timeOff.filter(function (t) { return d >= t.from && d <= t.to; })[0];
            list = list.map(function (x) { return x.t === 'card' ? angular.extend(card(x.r), { t: 'card', key: x.key }) : x; });
            return { key: d, word: w, label: C.fDay(d),
                n: list.length ? C.plural(real.length, 'booking') + ' · ' + C.len(real.reduce(function (s, x) { return s + x.r.mins; }, 0)) : 'Time off',
                off: off ? { title: off.title, part: off.all_day ? '' : D.hhmm(off.starts_at) + '–' + D.hhmm(off.ends_at) } : null, items: list };
        });
        var ltm = later.reduce(function (s, r) { return s + r.mins; }, 0);
        V.later = { sub: filt ? C.plural(later.length, 'booking') + ' in the next 30 days' : 'The next 30 days · ' + C.plural(later.length, 'booking') + ' · ' + C.len(ltm) + ' booked',
            quiet: !order.length ? (filt ? 'Nothing else coming up for this search.' : 'Nothing else booked with you in the next 30 days.') : '' };
        V.more = filt ? null : hidden > 0 ? { t: 'Showing ' + C.plural(Math.min(S.days, 30), 'day') + ' ahead · ' + C.plural(hidden, 'more booking') + ' after ' + C.fDay(until), btn: true }
            : later.length ? { t: 'That\'s everything for the next 30 days. Later bookings are on the scheduler.', sched: C.addDays(today, 31) } : null;
        V.filtering = filt;
        vm.V = V;
        setPicked();
    }

    function endedGhost(r) {
        var o = r.offer, when = C.fDay(r.start) + ' ' + D.hhmm(r.start);
        if (o.state === 'closed' && o.closed_reason === 'cancelled') { return { key: r.key, b: 'Withdrawn', txt: who(r) + ' · ' + when + ' — ' + first(r) + ' cancelled the request' + (o.closed_note ? ': “' + o.closed_note + '”' : '') + '. Nothing was booked.' }; }
        if (o.state === 'closed') { return { key: r.key, b: 'Closed', txt: who(r) + ' · ' + when + ' — none of the times you offered was taken before they closed. Nothing was booked.' }; }
        // withdrawn by you: the mockup's quiet "Declined" line, the same words the page shows the moment you close it
        return { key: r.key, b: 'Declined', txt: who(r) + ' · ' + when + ' · ' + r.ac.reg + ' — the request is closed and ' + first(r) + ' has been emailed' + (o.closed_note ? ' your reason' : '') + '.' };
    }

    /* one booking card: everything the template shows, worked out once per build */
    function cardVm(r, o, clubTag) {
        var st = status(r), pend = r.status === 'pending' || r.waiting > 0, acts = [];
        if (isAsk(r)) {
            acts.push({ k: 'decline', cls: 'ta-btn--danger', ic: 'fa-times', t: 'Decline' });
            acts.push({ k: 'suggest', cls: '', ic: 'fa-exchange-alt', t: isBack(r) ? 'Suggest other times' : 'Suggest a time' });
            if (!isBack(r)) { acts.push({ k: 'approve', cls: 'ta-btn--good', ic: 'fa-check', t: 'Confirm' }); }
        } else if (isOpenOffer(r)) {
            if (r.can_revise) { acts.push({ k: 'suggest', cls: '', ic: 'fa-pen', t: 'Change times' }); }
        } else if (toFile(r) && r.flight.sheet_id) {
            acts.push({ k: 'debrief', cls: 'ta-btn--primary', ic: 'fa-clipboard-check', t: 'File the debrief' });
        } else if (o.next && r.can_book_out) {
            acts.push({ k: 'bookout', cls: 'ta-btn--good', ic: 'fa-plane-departure', t: 'Book out', reg: r.ac.reg });
        }
        var tags = [];
        if (r.solo && r.kind === 'solo') { tags.push({ ic: 'fa-user', t: r.solo_source === 'lesson' ? 'Solo lesson' : 'Potential solo', title: r.solo_source === 'lesson' ? 'The lesson is a solo lesson' : 'Flagged as a potential solo' }); }
        if (clubTag && r.club_name) { tags.push({ ic: 'fa-map-marker-alt', t: r.club_name }); }
        if (r.passengers.length) { tags.push({ ic: 'fa-users', t: C.plural(r.passengers.length, 'passenger') }); }
        return {
            r: r, st: st, acts: acts, tags: tags, day: o.day ? C.fDay(r.start) : '',
            kic: D.kindIcon(r.kind), klabel: D.kindLabel(r.kind), time: D.hhmm(r.start), endT: D.hhmm(r.end), len: C.len(r.mins), who: who(r), nm: first(r),
            what: D.kindLabel(r.kind) + (r.lesson ? ' · ' + r.lesson.title : '') + (r.voucher ? ' · ' : ''), vch: r.voucher ? (r.voucher.code || '#' + r.voucher.id) : '',
            acTitle: r.ac.reg + (r.ac.model ? ' · ' + r.ac.model : ''), askedAt: r.created_at ? asked(r.created_at) : '',
            cls: 'msc-bk--' + r.kind + (pend ? ' msc-bk--pend' : '') + (released(r) ? ' msc-bk--moved' : '') + (r.complete ? ' msc-bk--done' : '') + (r.justNow ? ' msc-bk--hi' : ''),
            acts3: acts.length === 3, ask: isReq(r), offer: released(r) ? offerVm(r) : null, det: detailVm(r)
        };
    }
    function offerVm(r) {
        var o = r.offer, back = o.state === 'replied', live = liveTimes(r).length;
        return {
            back: back, nm: first(r), reply: o.reply || 'None of these work for me.', repliedAt: asked(o.replied_at), n: C.plural(o.times.length, 'time'),
            askedAt: C.fDay(r.start) + ' ' + D.hhmm(r.start), sent: asked(o.sent_at), until: o.open_until ? C.fDay(o.open_until) + ' ' + D.hhmm(o.open_until) : '',
            goneN: back ? 0 : o.times.length - live, goneTxt: C.plural(o.times.length - live, 'time') + ' taken by someone else since',
            liveN: C.plural(live, 'other time'),
            chips: o.times.map(function (t) {
                var gone = !back && t.gone;
                return { key: t.index + '|' + t.start + '|' + t.plane.id, when: optWhen(t), reg: t.plane.reg, why: D.acWhy(t.plane, t.same, r.ac, first(r)).t, colour: t.plane.colour, gone: gone, early: !gone && !back && !!t.closes_at && !!o.open_until && t.closes_at < o.open_until };
            })
        };
    }
    function detailVm(r) {
        var facts = [], today = vm.today();
        facts.push({ k: 'When', v: C.fDayLong(r.start), s: ' · ' + range(r) + ' · ' + C.len(r.mins) });
        facts.push({ k: 'Aircraft', v: r.ac.reg, s: r.ac.model ? ' · ' + r.ac.model : '' });
        facts.push({ k: r.pilot && r.pilot.student ? 'Student' : 'Pilot', contact: true });
        if (r.course) { facts.push({ k: 'Course', v: r.course.title }); }
        if (r.lesson) { facts.push({ k: 'Lesson', v: r.lesson.title, s: r.solo_source === 'lesson' ? ' · solo lesson' : r.solo ? ' · flagged as a potential solo' : '' }); }
        if (r.voucher) { facts.push({ k: 'Paid with', v: 'Voucher ' + (r.voucher.code || ('#' + r.voucher.id)), s: ' · trial lesson' }); }
        if (r.rental.length) { facts.push({ k: 'Rental items', v: r.rental.map(function (x) { return (x.quantity || 1) + ' × ' + x.title; }).join(', ') }); }
        if (r.passengers.length) { facts.push({ k: 'Passengers', v: r.passengers.map(function (p) { return p.name || 'Passenger'; }).join(', ') }); }
        if (r.club_name) { facts.push({ k: 'Club', v: r.club_name }); }
        if (r.created_at) {
            var by = r.booked_by ? (+r.booked_by.id === C.myId() ? 'you' : r.booked_by.name) : '';
            facts.push({ k: 'Booked', v: C.fDate(r.created_at), s: by ? ' · by ' + by : '' });
        }
        if (r.lesson && !r.complete && r.briefed !== null) { facts.push({ k: 'Brief', v: r.briefed ? 'Given' : 'Not given yet' }); }
        var right = [];
        if (isAsk(r)) {
            right.push({ k: 'decline', cls: 'ta-btn--danger', ic: 'fa-times', t: 'Decline' });
            right.push({ k: 'suggest', cls: '', ic: 'fa-exchange-alt', t: isBack(r) ? 'Suggest other times' : 'Suggest a time' });
            if (!isBack(r)) { right.push({ k: 'approve', cls: 'ta-btn--good', ic: 'fa-check', t: 'Confirm ' + first(r) }); }
        } else if (isOpenOffer(r)) {
            if (r.can_withdraw) { right.push({ k: 'decline', cls: 'ta-btn--danger', ic: 'fa-times', t: 'Close the request' }); }
            if (r.can_revise) { right.push({ k: 'suggest', cls: '', ic: 'fa-pen', t: 'Change times' }); }
        } else if (toFile(r) && r.flight.sheet_id) {
            right.push({ k: 'debrief', cls: 'ta-btn--primary', ic: 'fa-clipboard-check', t: 'File the debrief' });
        } else if (flying(r) && r.can_book_in && r.flight.sheet_id) {
            right.push({ k: 'bookin', cls: 'ta-btn--good', ic: 'fa-plane-arrival', t: 'Book in ' + r.ac.reg });
        } else if (r.day === today && !r.complete && !flying(r) && r.can_book_out && r.status === 'confirmed') {
            right.push({ k: 'bookout', cls: 'ta-btn--good', ic: 'fa-plane-departure', t: 'Book out ' + r.ac.reg });
        }
        return {
            facts: facts, right: right,
            records: !!(r.pilot && r.pilot.student && r.pilot.id), brief: !!(r.lesson && r.lesson.id && !r.complete && r.briefed === false && !isAsk(r)),
            askNote: isReq(r), openNote: isOpenOffer(r), clubNote: r.status === 'pending' && !r.can_approve && r.src === 'booking' && !r.waiting,
            fileNote: toFile(r), flyNote: flying(r)
        };
    }

    /* ════════ actions ════════ */
    vm.act = function (k, r, ev) {
        if (k === 'approve') { return approve(r); }
        if (k === 'decline') { return openDecline(r, ev); }
        if (k === 'suggest') { return openSuggest(r, ev); }
        if (k === 'debrief') { return $state.go('dashboard.manage_user.debriefing', { booking_id: r.id, plane_log_sheet_id: r.flight.sheet_id, split_next_id: 0, split_booking_id: 0 }); }
        if (k === 'bookout') { return $state.go('dashboard.my_account.bookout_with_booking', { booking_id: r.id }); }
        if (k === 'bookin') { return $state.go('dashboard.my_account.book_in', { id: r.flight.sheet_id }); }
    };
    vm.goSched = function (day) { $state.go('dashboard.scheduler_v2', { date: day || vm.today() }); };
    vm.goAvail = function () { $state.go('dashboard.manage_user.instructor_availability'); };
    vm.goRecords = function (r) { $state.go('dashboard.manage_user.student_records', { club_id: r.club_id, student_id: r.pilot.id, course_id: r.course ? r.course.id : null }); };
    vm.goBrief = function (r) { $state.go('dashboard.manage_user.briefing_lesson', { booking_id: r.id, lesson_id: r.lesson.id, club_id: r.club_id }); };
    vm.bookIn = function (g) {
        var day = g.at.slice(0, 10), m = Math.ceil(D.t2m(D.hhmm(g.at)) / 30) * 30;
        $state.go('dashboard.scheduler_v2.add', { date: day, instructor_id: C.myId(), start: day + 'T' + D.m2t(m) + ':00', duration: Math.max(30, Math.min(g.mins, 120)) });
    };

    /* a card that leaves the list: fade and collapse (~200 ms), then the change lands */
    function leave(r) {
        var d = $q.defer(), el = document.getElementById('msc-bk-' + r.key);
        if (!el || !el.animate || (reduce && reduce.matches)) { d.resolve(); return d.promise; }
        var h = el.offsetHeight;
        el.style.pointerEvents = 'none';
        var a = el.animate([
            { opacity: 1, height: h + 'px', marginBottom: '0px', transform: 'scale(1)' },
            { opacity: 0, height: '0px', marginBottom: '-8px', borderTopWidth: '0px', borderBottomWidth: '0px', transform: 'scale(0.985)' }
        ], { duration: 220, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });
        // once the change has landed, drop the animation: an element Angular keeps (same key) must not stay collapsed
        a.onfinish = function () { $scope.$applyAsync(d.resolve); $timeout(function () { a.cancel(); el.style.pointerEvents = ''; }, 60, false); };
        return d.promise;
    }

    function approve(r) {
        if (vm.busy[r.key]) { return; }
        vm.busy[r.key] = true;
        D.accept(r.id).then(function (res) {
            if (!res || !res.success) {
                delete vm.busy[r.key];
                ToastService.error('Not confirmed', (res && typeof res.message === 'string' && res.message) || 'The request could not be confirmed — nothing has changed.');
                quietRefresh();
                return;
            }
            leave(r).then(function () {
                delete vm.busy[r.key];
                r.status = 'confirmed'; r.can_approve = false; r.pending_by = null; r.justNow = true;
                if (vm.S.open === r.key) { vm.S.open = null; }
                if (vm.S.kind === 'confirm' && !vm.rows.some(isAsk)) { vm.S.kind = 'all'; }
                rebuild();
                ToastService.success('Confirmed', first(r) + ' has been emailed, with a calendar invite.', QUIET);
                quietRefresh();
            });
        });
    }

    /* ── dialogs: a record dialog on desktop, a bottom sheet on phones (ta-base); Esc, the scrim and × close them ── */
    function focusDlg(id) { $timeout(function () { var el = document.getElementById(id); if (el) { el.focus(); } }, 30, false); }
    function restore() { var o = opener; opener = null; if (o && o.focus && document.documentElement.contains(o)) { $timeout(function () { o.focus(); }, 0, false); } }
    vm.scrim = function (ev) { if (ev && ev.target === ev.currentTarget) { vm.close(); } };
    vm.close = function () {
        if ((vm.dlg && vm.dlg.busy) || (vm.sug && vm.sug.busy)) { return; }
        vm.dlg = null; vm.sug = null; restore();
    };
    function onKey(e) {
        if (e.keyCode !== 27 || e.defaultPrevented) { return; }
        if (document.querySelector('.tadp-pop--open')) { return; }   // an open date picker closes itself first
        $scope.$apply(function () {
            if (vm.sug || vm.dlg) { vm.close(); return; }
            if (vm.S.open) { vm.S.open = null; }
        });
    }
    $document.on('keydown', onKey);

    /* Decline (a request: the booking is cancelled) / Close the request (a released one: the times are withdrawn) */
    function openDecline(r, ev) {
        opener = ev && ev.currentTarget ? ev.currentTarget : document.activeElement;
        vm.sug = null;
        vm.dlg = { r: r, reason: '', busy: false, rel: released(r) };
        focusDlg('msc-dlg');
    }
    vm.reasonChip = function (t) { var d = vm.dlg; d.reason = d.reason === t ? '' : t; };
    vm.declineToSuggest = function () { var r = vm.dlg.r; vm.dlg = null; openSuggest(r); };
    vm.declineGo = function () {
        var d = vm.dlg; if (!d || d.busy) { return; }
        var r = d.r, reason = String(d.reason || '').trim();
        d.busy = true;
        (d.rel ? D.withdraw(r.oid, reason) : D.decline(r.id, reason)).then(function (res) {
            if (!res || !res.success) {
                d.busy = false;
                var over = res && (res.error === 'NOT_OPEN' || res.error === 'NOT_FOUND');
                ToastService.error(d.rel ? 'Not closed' : 'Not declined', (res && typeof res.message === 'string' && res.message) || 'Nothing has changed — try again in a moment.');
                if (over) { vm.dlg = null; restore(); quietRefresh(); }
                return;
            }
            vm.dlg = null; restore();
            leave(r).then(function () {
                vm.gone[r.key] = { key: r.key, b: 'Declined', txt: who(r) + ' · ' + C.fDay(r.start) + ' ' + D.hhmm(r.start) + ' · ' + r.ac.reg + ' — ' + (d.rel ? 'the request is closed' : 'the booking is cancelled') + ' and ' + first(r) + ' has been emailed' + (reason ? ' your reason' : '') + '.' };
                r._gone = true;
                vm.rows = vm.rows.filter(function (x) { return x !== r; });
                if (vm.S.open === r.key) { vm.S.open = null; }
                if (vm.S.kind === 'confirm' && !vm.rows.some(isAsk)) { vm.S.kind = 'all'; }
                rebuild();
                ToastService.success('Declined', d.rel ? first(r) + '\'s request is closed and they\'ve been emailed.' : first(r) + '\'s booking is cancelled and they\'ve been emailed.', QUIET);
                quietRefresh();
            });
        });
    };

    /* ════════ Suggest a time ════════ */
    function sugFrom(r) { var today = vm.today(), f = C.addDays(r.day, -2); return f < today ? today : f; }
    function openSuggest(r, ev) {
        opener = ev && ev.currentTarget ? ev.currentTarget : (opener || document.activeElement);
        vm.dlg = null;
        var edit = isOpenOffer(r), today = vm.today();
        var g = vm.sug = {
            r: r, edit: edit, picks: [], more: false, ownOpen: false, own: { day: '', time: '' }, note: edit ? r.offer.note || '' : '',
            busy: false, loading: true, failed: false, list: [], rows: [], problems: null, problemList: null, chk: null, ownLoading: false,
            type: r.ac.type || 'aircraft', nm: first(r), times: [], released: released(r),
            dpOpts: { min: today, max: C.addDays(today, 30) }
        };
        for (var t = 420; t <= 1200 - r.mins; t += 30) { g.times.push(D.m2t(t)); }
        if (edit) { g.picks = liveTimes(r).map(function (t) { return { key: t.day + '|' + D.m2t(t.s) + '|' + t.plane.reg, day: t.day, s: t.s, e: t.e, plane: t.plane, same: t.same }; }); }
        sugRebuild();
        focusDlg('msc-sug');
        loadTimes(g);
    }
    /* the times to suggest: the server's ranking (one read: the request's route, or the offer's for a released request); a failed
       read → the engine */
    function loadTimes(g) {
        var r = g.r, today = vm.today();
        g.loading = true; g.server = null;
        (r.src === 'booking' ? D.suggestions(r.id) : D.offerSuggestions(r.oid)).then(function (res) {
            if (vm.sug !== g) { return; }
            if (res && res.success !== false && angular.isArray(res.suggestions)) {
                var eng = sugEngine();
                // never a time you've already offered someone else (first come, first served — but not twice by you)
                g.server = res.suggestions.map(function (x) { return D.normSuggestion(x, r.ac); }).filter(function (o) { return !eng.offeredTo(o.day, o.s, o.e); });
                g.source = 'server'; g.loading = false; g.failed = false;
                sugRebuild();
                return;
            }
            var from = sugFrom(r);
            ensure(r.club_id, from, C.daysBetween(from, C.addDays(r.day, 14)) + 1).then(function (ok) {
                if (vm.sug !== g) { return; }
                g.source = 'engine'; g.loading = false; g.failed = !ok;
                if (!ok) { g.ownOpen = true; if (!g.own.day) { g.own.day = r.day > today ? r.day : C.addDays(today, 1); } }
                sugRebuild();
            });
        });
    }
    /* the reads the ranking needs, cached for the page's life (per club and day) */
    function ensure(clubId, from, days) {
        var need = [], pv = [];
        for (var i = 0; i < days; i++) {
            var d = C.addDays(from, i);
            if (!schedCache[clubId + '|' + d]) { need.push(d); }
            if (!prevCache[clubId + '|' + d]) { pv.push(d); }
        }
        var calls = [];
        if (need.length) {
            calls.push(D.schedDays(clubId, need[0], C.daysBetween(need[0], need[need.length - 1]) + 1).then(function (s) {
                if (!s.success) { return false; }
                var club = schedCache['club' + clubId] = schedCache['club' + clubId] || { planes: [], books: [], hours: null, seen: {} };
                s.planes.forEach(function (p) { if (!club.seen['p' + p.id]) { club.seen['p' + p.id] = 1; club.planes.push(p); } });
                s.books.forEach(function (b) { if (!club.seen['b' + b.id]) { club.seen['b' + b.id] = 1; club.books.push(b); } });
                if (s.hours) { club.hours = s.hours; }
                need.forEach(function (x) { schedCache[clubId + '|' + x] = 1; });
                return true;
            }));
        }
        if (pv.length) {
            calls.push(D.preview(clubId, pv[0], Math.min(62, C.daysBetween(pv[0], pv[pv.length - 1]) + 1)).then(function (p) {
                var pc = prevCache['club' + clubId] = prevCache['club' + clubId] || { days: {}, setUp: true };
                if (p && p.success !== false && angular.isArray(p.days)) {
                    pc.setUp = p.set_up !== false;
                    p.days.forEach(function (x) { pc.days[x.date] = (x.windows || []).map(function (w) { return [D.t2m(w.from), w.to === '24:00' ? 1440 : D.t2m(w.to)]; }); });
                } else { pc.setUp = false; }
                pv.forEach(function (x) { prevCache[clubId + '|' + x] = 1; });
                return true;
            }));
        }
        return $q.all(calls).then(function (oks) { return oks.every(Boolean); });
    }
    function sugEngine() {
        var g = vm.sug, r = g.r, pc = prevCache['club' + r.club_id] || { days: {}, setUp: true };
        return D.engine({ b: r, me: C.myId(), now: nowStr(), rows: vm.rows, sched: schedCache['club' + r.club_id] || null, prev: pc.days, setUp: pc.setUp, timeOff: vm.timeOff });
    }
    function sugRebuild() {
        var g = vm.sug; if (!g) { return; }
        var r = g.r;
        g.full = g.picks.length >= D.MAX_TIMES;
        g.list = g.loading || g.failed ? [] : (g.server || sugEngine().list());
        // six (or twelve) rows in all, as the mockup: times already offered that the ranking leaves out (the server never re-suggests
        // an offer's own times) take a place each; your own times added below come on top
        var extra = g.picks.filter(function (p) { return !p.own && !g.list.some(function (o) { return o.key === p.key; }); }).length;
        var shown = g.list.slice(0, Math.max(0, (g.more ? 12 : 6) - extra));
        g.picks.forEach(function (p) { if (!shown.some(function (o) { return o.key === p.key; })) { shown.push(p); } });
        shown.sort(function (x, y) { return x.day < y.day ? -1 : x.day > y.day ? 1 : x.s - y.s; });
        var rows = [], lastDay = '';
        shown.forEach(function (o) {
            if (o.day !== lastDay) {
                lastDay = o.day;
                var dd = o.dayOffset != null ? +o.dayOffset : C.daysBetween(r.day, o.day);
                rows.push({ t: 'day', key: 'd' + o.day, label: C.fDay(o.day), rel: dd === 0 ? 'the day ' + g.nm + ' asked for' : dd > 0 ? C.plural(dd, 'day') + ' later' : C.plural(-dd, 'day') + ' earlier' });
            }
            var on = g.picks.some(function (p) { return p.key === o.key; });
            rows.push({ t: 'opt', key: o.key, o: o, on: on, off: !on && g.full, bad: !!(g.problems && g.problems[o.key]), why: D.acWhy(o.plane, o.same, r.ac, g.nm) });
        });
        g.rows = rows;
        g.chk = g.ownOpen ? ownCheck() : null;
        g.sendLabel = g.picks.length ? 'Send ' + C.plural(g.picks.length, 'time') + ' to ' + g.nm : 'Pick a time to send';
    }
    function ownCheck() {
        var g = vm.sug;
        if (!g.own.day || !g.own.time || g.loading) { return null; }
        if (!schedCache[g.r.club_id + '|' + g.own.day] || !prevCache[g.r.club_id + '|' + g.own.day]) {
            if (!g.ownLoading) {
                g.ownLoading = true;
                ensure(g.r.club_id, g.own.day, 1).then(function () { if (vm.sug === g) { g.ownLoading = false; sugRebuild(); } });
            }
            return { tone: 'wait', msg: 'Checking ' + C.fDay(g.own.day) + '…' };
        }
        return sugEngine().check(g.own.day, g.own.time);
    }
    vm.sugPick = function (row) {
        var g = vm.sug; if (!g || g.busy) { return; }
        var i = g.picks.map(function (p) { return p.key; }).indexOf(row.key);
        if (i > -1) { g.picks.splice(i, 1); }
        else if (g.picks.length >= D.MAX_TIMES) { ToastService.warning('That\'s three', 'Untick one to swap it.'); return; }
        else { g.picks.push(angular.copy(row.o)); }
        if (g.problems) { delete g.problems[row.key]; g.problemList = (g.problemList || []).filter(function (p) { return p.key !== row.key; }); }
        sugRebuild();
    };
    vm.sugMore = function () { vm.sug.more = !vm.sug.more; sugRebuild(); };
    vm.sugOwnOpen = function () {
        var g = vm.sug; g.ownOpen = !g.ownOpen;
        if (g.ownOpen && !g.own.day) { var today = vm.today(); g.own.day = g.r.day > today ? g.r.day : C.addDays(today, 1); }
        sugRebuild();
    };
    $scope.$watch(function () { return vm.sug ? vm.sug.own.day : null; }, function (v, old) { if (vm.sug && v !== old) { sugRebuild(); } });
    vm.sugTime = function () { sugRebuild(); };
    vm.sugOwn = function () {
        var g = vm.sug, chk = g && g.chk;
        if (!chk || !chk.opt || g.picks.length >= D.MAX_TIMES) { return; }
        if (!g.picks.some(function (p) { return p.key === chk.opt.key; })) { g.picks.push(chk.opt); }
        g.own = { day: g.own.day, time: '' };
        sugRebuild();
    };
    vm.sugSend = function () {
        var g = vm.sug; if (!g || g.busy || !g.picks.length) { return; }
        var r = g.r, picks = g.picks.slice().sort(function (x, y) { return x.day < y.day ? -1 : x.day > y.day ? 1 : x.s - y.s; });
        var times = picks.map(function (p) { return { start: p.day + ' ' + D.m2t(p.s), end: p.day + ' ' + D.m2t(p.e), plane_id: p.plane.id }; });
        var note = String(g.note || '').trim(), was = r.src === 'offer' ? r.offer.state : 'request';
        g.busy = true; g.problems = null; g.problemList = null;
        (r.src === 'offer' ? D.revise(r.oid, times, note) : D.offer(r.id, times, note)).then(function (res) {
            if (vm.sug !== g) { return; }
            if (!res || !res.success) {
                g.busy = false;
                var probs = res && (res.problems || (res.data && res.data.problems));
                if (res && res.error === 'TIMES_REFUSED' && angular.isArray(probs)) {
                    ToastService.handledInline();
                    g.problems = {}; g.problemList = [];
                    probs.forEach(function (p) {
                        var pk = picks[+p.index]; if (!pk) { return; }
                        g.problems[pk.key] = p.message || 'That time can\'t be offered.';
                        g.problemList.push({ key: pk.key, when: optWhen(pk), reg: pk.plane.reg, msg: p.message || 'That time can\'t be offered.' });
                    });
                    // someone booked in the meantime: rank again (your picks stay, marked)
                    schedCache = {}; prevCache = {};
                    loadTimes(g);
                    sugRebuild();
                    return;
                }
                var over = res && (res.error === 'NOT_PENDING' || res.error === 'NOT_OPEN' || res.error === 'NOT_FOUND' || res.error === 'FORBIDDEN');
                ToastService.error('Not sent', (res && typeof res.message === 'string' && res.message) || 'The times could not be sent — nothing has changed.');
                if (over) { vm.sug = null; restore(); quietRefresh(); }
                return;
            }
            var item = res.offer && res.offer.offer_id ? D.normOffer(res.offer) : null, n = picks.length;
            vm.sug = null; restore();
            (was === 'open' ? $q.when() : leave(r)).then(function () {   // changed times stay where they are; anything else moves
                vm.rows = vm.rows.filter(function (x) { return x !== r; });
                if (item) { vm.rows.push(item); byStart(vm.rows); }
                if (vm.S.open === r.key) { vm.S.open = null; }
                if (vm.S.kind === 'confirm' && !vm.rows.some(isAsk)) { vm.S.kind = 'all'; }
                rebuild();
                if (was === 'open') { ToastService.success('Updated', first(r) + ' has been emailed ' + C.plural(n, 'time') + '.', QUIET); }
                else if (was === 'replied') { ToastService.success('Sent', first(r) + ' has been emailed ' + C.plural(n, 'other time') + '.', QUIET); }
                else { ToastService.success('Sent', first(r) + ' has been emailed ' + C.plural(n, 'time') + ', and the time asked for is released.', QUIET); }
                quietRefresh();
            });
        });
    };
}
