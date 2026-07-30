/* Nachbau der Supabase-Endpunkte, die der Wochenplaner benutzt.
   Nur für den Test — prüft, ob Anmeldung und Abgleich wirklich laufen. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const users = new Map();      // email -> {id, password}
const tokens = new Map();     // token -> user_id
const plans = new Map();      // user_id -> data
let n = 0;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Expose-Headers': '*'
};

function body(req) {
  return new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); });
}
function json(res, code, obj) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json' }, CORS));
  res.end(JSON.stringify(obj));
}
function userOf(req) {
  const a = req.headers.authorization || '';
  return tokens.get(a.replace('Bearer ', ''));
}
function session(u, email) {
  const t = 'tok_' + (++n);
  tokens.set(t, u);
  return { access_token: t, refresh_token: 'ref_' + t, expires_in: 3600, user: { id: u, email } };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    let html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    html = html.replace(/const SUPABASE = \{[\s\S]*?\};/,
      'const SUPABASE = {\n  url: "http://localhost:8899",\n  key: "test-anon-key"\n};');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  if (url.pathname === '/auth/v1/signup') {
    const d = JSON.parse(await body(req) || '{}');
    if (users.has(d.email)) return json(res, 400, { msg: 'User already registered' });
    const id = 'u' + (++n);
    users.set(d.email, { id, password: d.password });
    return json(res, 200, session(id, d.email));
  }

  if (url.pathname === '/auth/v1/token') {
    const d = JSON.parse(await body(req) || '{}');
    if (url.searchParams.get('grant_type') === 'refresh_token') {
      const uid = tokens.get(String(d.refresh_token).replace('ref_', ''));
      if (!uid) return json(res, 401, { msg: 'bad refresh' });
      return json(res, 200, session(uid, null));
    }
    const u = users.get(d.email);
    if (!u || u.password !== d.password) return json(res, 400, { error_description: 'Invalid login credentials' });
    return json(res, 200, session(u.id, d.email));
  }

  if (url.pathname === '/auth/v1/user') {
    const uid = userOf(req);
    if (!uid) return json(res, 401, { msg: 'no' });
    let email = null;
    users.forEach((v, k) => { if (v.id === uid) email = k; });
    return json(res, 200, { id: uid, email });
  }

  if (url.pathname === '/auth/v1/logout') { return json(res, 204, {}); }

  if (url.pathname === '/rest/v1/plans') {
    const uid = userOf(req);
    if (!uid) return json(res, 401, { msg: 'no' });
    if (req.method === 'GET') {
      const d = plans.get(uid);
      return json(res, 200, d ? [{ data: d }] : []);
    }
    if (req.method === 'POST') {
      const d = JSON.parse(await body(req) || '{}');
      plans.set(uid, d.data);
      return json(res, 201, {});
    }
  }

  json(res, 404, { msg: 'nope' });
});

server.listen(8899, () => console.log('mock läuft auf 8899'));
