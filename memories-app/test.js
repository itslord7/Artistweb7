const http = require('http');

const BASE = '127.0.0.1';
const PORT = process.env.TEST_PORT || 4567;
let cookie = '';
let failures = 0;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      { host: BASE, port: PORT, method, path, headers: {
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      } },
      (res) => {
        const setCookie = res.headers['set-cookie'];
        if (setCookie) cookie = setCookie[0].split(';')[0];
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => resolve({ status: res.statusCode, body: buf ? JSON.parse(buf) : null }));
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function check(name, cond, extra = '') {
  if (cond) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name} ${extra}`); }
}

(async () => {
  const home = await new Promise((resolve, reject) => {
    http.get({ host: BASE, port: PORT, path: '/' }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    }).on('error', reject);
  });
  check('GET / serves HTML', home.status === 200 && home.body.includes('ذكرياتي'));

  const anon = await req('GET', '/api/memories');
  check('GET /api/memories without auth -> 401', anon.status === 401);

  const reg = await req('POST', '/api/register', { username: 'tester', password: 'secret123' });
  check('register -> 201', reg.status === 201 && reg.body.user === 'tester');

  const dup = await req('POST', '/api/register', { username: 'tester', password: 'secret123' });
  check('duplicate register -> 409', dup.status === 409);

  const me = await req('GET', '/api/me');
  check('GET /api/me after register', me.status === 200 && me.body.user === 'tester');

  const add = await req('POST', '/api/memories', { title: 'أول يوم في العمل', date: '2025-05-01', text: 'يوم جميل ومميز', mood: 'سعيدة 😄' });
  check('POST /api/memories -> 201', add.status === 201 && add.body.memory.id);
  const id = add.body.memory && add.body.memory.id;

  const badAdd = await req('POST', '/api/memories', { title: '', date: 'bad', text: '' });
  check('invalid memory -> 400', badAdd.status === 400);

  const list = await req('GET', '/api/memories');
  check('GET /api/memories lists 1', list.status === 200 && list.body.memories.length === 1);

  const logout = await req('POST', '/api/logout');
  check('logout -> 200', logout.status === 200);
  cookie = '';

  const meAfter = await req('GET', '/api/me');
  check('GET /api/me after logout -> null', meAfter.status === 200 && meAfter.body.user === null);

  const badLogin = await req('POST', '/api/login', { username: 'tester', password: 'wrongpass' });
  check('wrong password -> 401', badLogin.status === 401);

  const login = await req('POST', '/api/login', { username: 'tester', password: 'secret123' });
  check('login -> 200', login.status === 200 && login.body.user === 'tester');

  const list2 = await req('GET', '/api/memories');
  check('memories persist across sessions', list2.body.memories.length === 1);

  const del = await req('DELETE', `/api/memories/${id}`);
  check('DELETE memory -> 200', del.status === 200);
  const list3 = await req('GET', '/api/memories');
  check('list empty after delete', list3.body.memories.length === 0);

  console.log(failures ? `\n${failures} FAILURES` : '\nALL TESTS PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
