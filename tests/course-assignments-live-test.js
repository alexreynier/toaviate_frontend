/**
 * Course Assignments (sharing) — LIVE local-API verification.
 *
 * Drives the same endpoints the new UI calls, against local-api.toaviate.com,
 * using the disposable test account in tests/sms-local-test.config.json.
 *
 * Flow:
 *   login handshake → list club members (pick a student) → Share a questionnaire
 *   with them → ForItem roster (instructor "who's it shared with") → mine/count
 *   → Revoke → confirm it drops off the roster.
 *
 * Run: node tests/course-assignments-live-test.js
 *
 * NOTE: the session is bound to the User-Agent from login — we always send the
 * SAME UA from the config (mismatch => "login session expired").
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'sms-local-test.config.json'), 'utf8'));
const acct = cfg.accounts[0];
const HOST = cfg.base_host;
const UA = cfg.user_agent;
const API_KEY = cfg.api_key;

let pass = 0, fail = 0;
function assert(cond, name, extra) {
    if (cond) { console.log('  PASS  ' + name); pass++; }
    else { console.log('  FAIL  ' + name + (extra ? '  →  ' + extra : '')); fail++; }
}
function section(n) { console.log('\n=== ' + n + ' ==='); }

let SESSION = null, USER_ID = null;

function req(method, urlPath, body, auth) {
    return new Promise((resolve, reject) => {
        const data = body != null ? JSON.stringify(body) : null;
        const headers = { 'Content-Type': 'application/json', 'User-Agent': UA, 'Api-Key': API_KEY };
        if (data) headers['Content-Length'] = Buffer.byteLength(data);
        if (auth && SESSION && USER_ID != null) {
            headers['Authorization'] = 'Basic ' + Buffer.from(USER_ID + ':' + SESSION).toString('base64');
            headers['Session'] = SESSION;
        }
        const r = https.request({ host: HOST, port: 443, method, path: urlPath, headers, rejectUnauthorized: false }, (res) => {
            let chunks = '';
            res.on('data', (c) => chunks += c);
            res.on('end', () => {
                let parsed = null;
                try { parsed = chunks ? JSON.parse(chunks) : null; } catch (e) { parsed = chunks; }
                resolve({ status: res.statusCode, body: parsed });
            });
        });
        r.on('error', reject);
        if (data) r.write(data);
        r.end();
    });
}

async function login() {
    const r0 = await req('POST', '/api/v1/users/login0', {}, false);
    const loginSession = r0.body && (r0.body.login_session || r0.body.session);
    if (!loginSession) throw new Error('login0 failed: ' + JSON.stringify(r0.body));
    const a1 = Buffer.from(loginSession + ',' + acct.email).toString('base64');
    const r1 = await req('POST', '/api/v1/users/login1', { a: a1 }, false);
    const loginKey = r1.body && (r1.body.login_key || r1.body.key);
    if (!loginKey) throw new Error('login1 failed: ' + JSON.stringify(r1.body));
    const a2 = Buffer.from(loginKey + ',' + acct.password).toString('base64');
    const r2 = await req('POST', '/api/v1/users/login2', { a: a2 }, false);
    if (!r2.body || !r2.body.session || !r2.body.user) throw new Error('login2 failed: ' + JSON.stringify(r2.body));
    SESSION = r2.body.session;
    USER_ID = r2.body.user.id;
    return r2.body.user;
}

(async () => {
    try {
        section('Auth');
        const user = await login();
        assert(!!SESSION && USER_ID != null, 'login handshake → session + user', 'user ' + USER_ID);

        section('Pick a student in club ' + acct.club_id);
        const members = await req('GET', '/api/v1/members/club/' + acct.club_id, null, true);
        const list = Array.isArray(members.body) ? members.body : (members.body && members.body.members) || [];
        assert(list.length > 0, 'club members load', list.length + ' members');
        // Pick a member that isn't ourselves.
        const student = list.find(m => (m.user_id || m.id) && (m.user_id || m.id) != USER_ID) || list[0];
        const studentId = student.user_id || student.id;
        assert(!!studentId, 'have a student id', String(studentId));

        section('Find a questionnaire to share');
        const qs = await req('GET', '/api/v1/questionnaires/club/' + acct.club_id, null, true);
        const qlist = Array.isArray(qs.body) ? qs.body : (qs.body && qs.body.items) || [];
        assert(qlist.length > 0, 'questionnaires list', qlist.length + ' found');
        const q = qlist[0];
        const qid = q.id || q._qid;

        section('Share (instructor → student)');
        const share = await req('POST', '/api/v1/course_assignments', {
            item_type: 'questionnaire',
            item_id: qid,
            student_ids: [studentId],
            message: 'LIVE TEST — please ignore',
            due_date: null,
            send_email: false
        }, true);
        assert(share.status >= 200 && share.status < 300, 'share returns 2xx', 'status ' + share.status);
        const results = (share.body && (share.body.results || share.body.shared_with)) || [];
        assert(share.body && (share.body.shared || results.length), 'share reports recipients', JSON.stringify(share.body).slice(0, 200));

        section('Instructor follow-up: ForItem roster');
        const roster = await req('GET', '/api/v1/course_assignments/item/questionnaire/' + qid, null, true);
        const rrows = Array.isArray(roster.body) ? roster.body
            : (roster.body && (roster.body.assignments || roster.body.items)) || [];
        assert(rrows.length > 0, 'ForItem returns roster', rrows.length + ' rows');
        const mine = rrows.find(r => (r.student_id || r.user_id) == studentId);
        assert(!!mine, 'our share appears on roster');
        if (mine) {
            assert(!!mine.status, 'roster row has a status', mine.status);
            const hasName = mine.student_name || mine.first_name || mine.email;
            assert(!!hasName, 'roster row has a name/email to display', JSON.stringify(mine).slice(0, 160));
        }
        const assignmentId = mine && mine.id;

        section('Student inbox count');
        const count = await req('GET', '/api/v1/course_assignments/mine/count', null, true);
        assert(count.status === 200 && count.body && typeof count.body.count === 'number',
            'mine/count returns {count}', JSON.stringify(count.body));

        section('Revoke (cleanup)');
        if (assignmentId) {
            const rev = await req('POST', '/api/v1/course_assignments/' + assignmentId + '/revoke', {}, true);
            assert(rev.status >= 200 && rev.status < 300, 'revoke returns 2xx', 'status ' + rev.status);
            const after = await req('GET', '/api/v1/course_assignments/item/questionnaire/' + qid, null, true);
            const arows = Array.isArray(after.body) ? after.body
                : (after.body && (after.body.assignments || after.body.items)) || [];
            const stillThere = arows.find(r => r.id === assignmentId);
            // Backend may keep the row with status 'revoked' for the instructor's audit
            // trail (it's hidden from the STUDENT's inbox, verified separately). Accept
            // either: gone, OR present-but-marked-revoked.
            const ok = !stillThere || (stillThere.status === 'revoked' || stillThere.revoked || stillThere.revoked_at);
            assert(ok, 'after revoke: row is gone OR marked revoked',
                stillThere ? ('status=' + stillThere.status + ' ' + JSON.stringify(stillThere).slice(0, 160)) : 'gone');

            // Confirm it's gone from the STUDENT inbox view too (count should reflect it).
            const mineAfter = await req('GET', '/api/v1/course_assignments/mine', null, true);
            // (we're the instructor here, so this is OUR inbox — just assert the call is healthy)
            assert(mineAfter.status === 200, 'mine still queryable after revoke', 'status ' + mineAfter.status);
        } else {
            console.log('  SKIP  no assignment id returned — cannot revoke');
        }

        console.log('\n────────────────────────────');
        console.log('  ' + pass + ' passed, ' + fail + ' failed');
        process.exit(fail ? 1 : 0);
    } catch (e) {
        console.error('\nERROR:', e.message);
        process.exit(2);
    }
})();
