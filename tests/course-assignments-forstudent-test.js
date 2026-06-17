/**
 * Course Assignments — ForStudent (instructor per-student roster) LIVE check.
 * Shares a questionnaire with a student, then confirms ForStudent returns it
 * with item_title + status (what the "Assigned to {student}" card renders),
 * then revokes for cleanup.
 *
 * Run: node tests/course-assignments-forstudent-test.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'sms-local-test.config.json'), 'utf8'));
const acct = cfg.accounts[0];
const HOST = cfg.base_host, UA = cfg.user_agent, API_KEY = cfg.api_key;
let pass = 0, fail = 0, SESSION = null, USER_ID = null;
function assert(c, n, e) { if (c) { console.log('  PASS  ' + n); pass++; } else { console.log('  FAIL  ' + n + (e ? '  →  ' + e : '')); fail++; } }
function section(n) { console.log('\n=== ' + n + ' ==='); }

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
            let ch = ''; res.on('data', (c) => ch += c);
            res.on('end', () => { let p = null; try { p = ch ? JSON.parse(ch) : null; } catch (e) { p = ch; } resolve({ status: res.statusCode, body: p }); });
        });
        r.on('error', reject); if (data) r.write(data); r.end();
    });
}
async function login() {
    const r0 = await req('POST', '/api/v1/users/login0', {}, false);
    const ls = r0.body && (r0.body.login_session || r0.body.session);
    const r1 = await req('POST', '/api/v1/users/login1', { a: Buffer.from(ls + ',' + acct.email).toString('base64') }, false);
    const lk = r1.body && (r1.body.login_key || r1.body.key);
    const r2 = await req('POST', '/api/v1/users/login2', { a: Buffer.from(lk + ',' + acct.password).toString('base64') }, false);
    SESSION = r2.body.session; USER_ID = r2.body.user.id; return r2.body.user;
}

(async () => {
    try {
        section('Auth'); await login(); assert(!!SESSION, 'login');

        const members = await req('GET', '/api/v1/members/club/' + acct.club_id, null, true);
        const list = Array.isArray(members.body) ? members.body : (members.body && members.body.members) || [];
        const student = list.find(m => (m.user_id || m.id) && (m.user_id || m.id) != USER_ID) || list[0];
        const studentId = student.user_id || student.id;

        const qs = await req('GET', '/api/v1/questionnaires/club/' + acct.club_id, null, true);
        const qlist = Array.isArray(qs.body) ? qs.body : (qs.body && qs.body.items) || [];
        const qid = qlist[0].id || qlist[0]._qid;

        section('Assign to student');
        const share = await req('POST', '/api/v1/course_assignments', {
            item_type: 'questionnaire', item_id: qid, student_ids: [studentId],
            message: 'LIVE TEST forstudent', send_email: false
        }, true);
        assert(share.status >= 200 && share.status < 300, 'assign 2xx', 'status ' + share.status);

        section('ForStudent roster (instructor per-student view)');
        const fs2 = await req('GET', '/api/v1/course_assignments/student/' + acct.club_id + '/' + studentId, null, true);
        const rows = Array.isArray(fs2.body) ? fs2.body : (fs2.body && (fs2.body.assignments || fs2.body.items)) || [];
        assert(rows.length > 0, 'ForStudent returns assignments', rows.length + ' rows');
        const mine = rows.find(r => (r.item_id == qid) && (r.item_type === 'questionnaire'));
        assert(!!mine, 'our just-assigned item appears');
        if (mine) {
            assert(!!mine.item_title, 'row has item_title (card needs it)', mine.item_title);
            assert(!!mine.status, 'row has status', mine.status);
            assert(!!mine.id, 'row has id (needed to revoke)');
        }

        section('Cleanup');
        if (mine && mine.id) {
            const rev = await req('POST', '/api/v1/course_assignments/' + mine.id + '/revoke', {}, true);
            assert(rev.status >= 200 && rev.status < 300, 'revoke 2xx', 'status ' + rev.status);
        }

        console.log('\n────────────\n  ' + pass + ' passed, ' + fail + ' failed');
        process.exit(fail ? 1 : 0);
    } catch (e) { console.error('\nERROR:', e.message); process.exit(2); }
})();
