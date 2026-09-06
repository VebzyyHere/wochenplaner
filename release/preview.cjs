// Lokale Vorschau. /beispiel zeigt echte App-Funktionen mit isolierten,
// flüchtigen Beispieldaten. /app öffnet die unveränderte App mit Speicherung.
// Nur Loopback; keine Veröffentlichung und kein Zugriff aus dem Heimnetz.
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.WP_PREVIEW_PORT || 8902);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.md':'text/plain; charset=utf-8'};
function demoHtml() {
  let html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname,'beispieldaten.json'),'utf8'));
  data.settings.theme = 'auto';
  // Eigener Speicherdummy: auch Sicherungen/Import/Zurücksetzen berühren in
  // dieser Ansicht keinen echten localStorage. Cloud und SW sind deaktiviert.
  html = html.replace(/\blocalStorage\b/g, 'beispielSpeicher')
    .replace(/const SUPABASE = \{[\s\S]*?\n\};/, 'const SUPABASE = { url: "", key: "" };')
    .replace('let state = Store.load() || freshState();', 'let state = ' + JSON.stringify(data).replace(/</g,'\\u003c') + ';')
    .replaceAll('"serviceWorker" in navigator','false');
  const setup = `<script>
  const beispielWerte = new Map();
  const beispielSpeicher = {getItem:k=>beispielWerte.get(k)||null,setItem:(k,v)=>beispielWerte.set(k,String(v)),removeItem:k=>beispielWerte.delete(k)};
  const WirklicheDate = Date;
  const beispielZeit = new WirklicheDate('2026-09-09T10:15:00+02:00').getTime();
  window.Date = class extends WirklicheDate { constructor(...args){super(...(args.length?args:[beispielZeit]));} static now(){return beispielZeit;} };
  </script>`;
  html = html.replace('<script>',setup+'\n<script>');
  html = html.replace('</style>',`
  .demo-hinweis {min-height:36px;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:4px 12px;padding:6px 12px;background:var(--ink);color:var(--on-ink);font-size:12px;}
  .demo-hinweis a {color:inherit;font-weight:600;}
  .app {height:calc(100dvh - 36px);}
  @media(max-width:500px){.demo-hinweis{font-size:11px;}}
  </style>`);
  html = html.replace('<body>','<body><div class="demo-hinweis"><span>Beispielwoche · Änderungen nur vorübergehend</span><a href="/app">Eigenen Plan öffnen ↗</a></div>');
  return html;
}
const server = http.createServer((req,res) => {
  try {
    const url = new URL(req.url,'http://127.0.0.1');
    if (url.pathname === '/beispiel') {
      res.writeHead(200,{'Content-Type':types['.html'],'Cache-Control':'no-store'}); return res.end(demoHtml());
    }
    const rel = url.pathname === '/app' || url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const target = path.resolve(root,rel);
    if (!target.startsWith(root + path.sep) || rel.split(/[\\/]/).some(s=>s.startsWith('.')) || !types[path.extname(target)] || !fs.statSync(target).isFile()) {
      res.writeHead(404); return res.end('Nicht gefunden');
    }
    res.writeHead(200,{'Content-Type':types[path.extname(target)],'Cache-Control':'no-cache'});
    fs.createReadStream(target).pipe(res);
  } catch { res.writeHead(404); res.end('Nicht gefunden'); }
});
server.listen(port,'127.0.0.1',()=>console.log('Beispiel: http://127.0.0.1:'+port+'/beispiel · Eigener Plan: /'));
