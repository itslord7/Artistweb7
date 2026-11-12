const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(ROOT, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function defaultDB() {
  return { users: [], memories: {}, sessions: {} };
}

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return defaultDB();
  }
}

function saveDB(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function sendJSON(res, status, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function readBody(req, limit = 100 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function getUser(db, req) {
  const token = parseCookies(req).session;
  if (!token) return null;
  const username = db.sessions[token];
  if (!username) return null;
  return username;
}

function publicMemory(m) {
  return { id: m.id, title: m.title, date: m.date, text: m.text, mood: m.mood, createdAt: m.createdAt };
}

function validateMemory(body) {
  const title = String(body.title || '').trim();
  const text = String(body.text || '').trim();
  const date = String(body.date || '').trim();
  const mood = String(body.mood || 'عادية').trim();
  if (!title || title.length > 100) return { error: 'العنوان مطلوب (حتى 100 حرف)' };
  if (!text || text.length > 5000) return { error: 'النص مطلوب (حتى 5000 حرف)' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'التاريخ غير صالح' };
  if (mood.length > 30) return { error: 'المشاعر غير صالحة' };
  return { value: { title, text, date, mood } };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  const db = loadDB();

  try {
    if (pathname.startsWith('/api/')) {
      if (pathname === '/api/register' && req.method === 'POST') {
        const body = await readBody(req);
        const username = String(body.username || '').trim();
        const password = String(body.password || '');
        if (username.length < 2 || username.length > 40 || /\s/.test(username)) {
          return sendJSON(res, 400, { error: 'اسم المستخدم يجب أن يكون بين 2 و 40 حرفًا وبدون مسافات' });
        }
        if (password.length < 6) {
          return sendJSON(res, 400, { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
        }
        if (db.users.some((u) => u.username === username)) {
          return sendJSON(res, 409, { error: 'اسم المستخدم موجود بالفعل' });
        }
        const salt = crypto.randomBytes(16).toString('hex');
        db.users.push({ username, salt, hash: hashPassword(password, salt), createdAt: Date.now() });
        db.memories[username] = db.memories[username] || [];
        const token = crypto.randomBytes(32).toString('hex');
        db.sessions[token] = username;
        saveDB(db);
        return sendJSON(res, 201, { user: username }, {
          'Set-Cookie': `session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`,
        });
      }

      if (pathname === '/api/login' && req.method === 'POST') {
        const body = await readBody(req);
        const username = String(body.username || '').trim();
        const password = String(body.password || '');
        const user = db.users.find((u) => u.username === username);
        if (!user || !safeEqual(user.hash, hashPassword(password, user.salt))) {
          return sendJSON(res, 401, { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }
        const token = crypto.randomBytes(32).toString('hex');
        db.sessions[token] = username;
        saveDB(db);
        return sendJSON(res, 200, { user: username }, {
          'Set-Cookie': `session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`,
        });
      }

      if (pathname === '/api/logout' && req.method === 'POST') {
        const token = parseCookies(req).session;
        if (token) {
          delete db.sessions[token];
          saveDB(db);
        }
        return sendJSON(res, 200, { ok: true }, {
          'Set-Cookie': 'session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
        });
      }

      if (pathname === '/api/me' && req.method === 'GET') {
        return sendJSON(res, 200, { user: getUser(db, req) });
      }

      if (pathname === '/api/memories' && req.method === 'GET') {
        const user = getUser(db, req);
        if (!user) return sendJSON(res, 401, { error: 'يجب تسجيل الدخول' });
        const list = (db.memories[user] || []).map(publicMemory);
        return sendJSON(res, 200, { memories: list });
      }

      if (pathname === '/api/memories' && req.method === 'POST') {
        const user = getUser(db, req);
        if (!user) return sendJSON(res, 401, { error: 'يجب تسجيل الدخول' });
        const body = await readBody(req);
        const check = validateMemory(body);
        if (check.error) return sendJSON(res, 400, { error: check.error });
        const memory = {
          id: crypto.randomUUID(),
          ...check.value,
          createdAt: Date.now(),
        };
        db.memories[user] = db.memories[user] || [];
        db.memories[user].push(memory);
        saveDB(db);
        return sendJSON(res, 201, { memory: publicMemory(memory) });
      }

      const deleteMatch = pathname.match(/^\/api\/memories\/([\w-]+)$/);
      if (deleteMatch && req.method === 'DELETE') {
        const user = getUser(db, req);
        if (!user) return sendJSON(res, 401, { error: 'يجب تسجيل الدخول' });
        const list = db.memories[user] || [];
        const idx = list.findIndex((m) => m.id === deleteMatch[1]);
        if (idx === -1) return sendJSON(res, 404, { error: 'الذكرى غير موجودة' });
        list.splice(idx, 1);
        saveDB(db);
        return sendJSON(res, 200, { ok: true });
      }

      return sendJSON(res, 404, { error: 'غير موجود' });
    }

    const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    let filePath = path.join(PUBLIC_DIR, safePath === '/' ? 'index.html' : safePath);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    const status = err.message === 'payload too large' ? 413 : err.message === 'invalid json' ? 400 : 500;
    if (status === 500) console.error(err);
    sendJSON(res, status, { error: status === 500 ? 'خطأ في السيرفر' : err.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Memories app running at http://127.0.0.1:${PORT}`);
});
