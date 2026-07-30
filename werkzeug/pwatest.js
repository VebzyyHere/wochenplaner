const { chromium, devices } = require('playwright');
(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone 13'], serviceWorkers: 'allow' });
  const p = await ctx.newPage();
  const errs = [], fehl = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  p.on('response', r => { if (r.status() >= 400) fehl.push(r.status() + ' ' + r.url()); });

  await p.goto('http://localhost:8901/');
  await p.waitForTimeout(1500);
  await p.evaluate(() => closeModal());

  const meta = await p.evaluate(async () => {
    const g = n => (document.querySelector(`meta[name="${n}"]`)||{}).content;
    const man = document.querySelector('link[rel=manifest]');
    let mj = null;
    try { mj = await (await fetch(man.href)).json(); } catch(e) { mj = 'FEHLER ' + e.message; }
    return {
      themeColor: g('theme-color'), appleCapable: g('apple-mobile-web-app-capable'),
      appleTitel: g('apple-mobile-web-app-title'),
      touchIcon: (document.querySelector('link[rel=apple-touch-icon]')||{}).href,
      manifest: mj && mj.name ? { name: mj.name, kurz: mj.short_name, display: mj.display,
        start: mj.start_url, icons: mj.icons.map(i=>i.sizes+(i.purpose?'/'+i.purpose:'')) } : mj
    };
  });
  console.log('1) App-Angaben:', JSON.stringify(meta, null, 1));

  const sw = await p.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return { registriert: !!r, aktiv: !!(r && r.active), scope: r && r.scope,
             controller: !!navigator.serviceWorker.controller };
  });
  console.log('2) Service Worker:', JSON.stringify(sw));

  const cache = await p.evaluate(async () => {
    const k = await caches.keys();
    const c = await caches.open(k[0]);
    const req = await c.keys();
    return { schluessel: k, drin: req.map(r => r.url.replace('http://localhost:8901','')) };
  });
  console.log('3) Zwischenspeicher:', JSON.stringify(cache));

  // Dunkles Erscheinungsbild -> Statusleistenfarbe
  const dark = await p.evaluate(() => { state.settings.theme='dark'; applyTheme();
    return document.getElementById('themeColor').content; });
  const light = await p.evaluate(() => { state.settings.theme='light'; applyTheme();
    return document.getElementById('themeColor').content; });
  console.log('4) Statusleiste dunkel/hell:', dark, '/', light);

  // Offline: laedt die App noch?
  await p.evaluate(() => { state.tasks.push({id:'t1',title:'Offline-Probe',areaId:'a7',done:false,frog:false}); save(); });
  await ctx.setOffline(true);
  const p2 = await ctx.newPage();
  const e2 = [];
  p2.on('pageerror', e => e2.push(e.message));
  let offlineOk = true;
  try { await p2.goto('http://localhost:8901/', { timeout: 15000 }); } catch (e) { offlineOk = 'FEHLER: ' + e.message; }
  await p2.waitForTimeout(1200);
  const offline = await p2.evaluate(() => ({
    titel: document.title, appDa: !!document.querySelector('.app'),
    aufgabe: state.tasks.some(t => t.title === 'Offline-Probe'),
    syncText: (document.getElementById('syncBadge')||{}).title
  })).catch(e => 'FEHLER ' + e.message);
  console.log('5) Ohne Netz geöffnet:', offlineOk === true ? JSON.stringify(offline) : offlineOk, e2.length?e2:'');
  await ctx.setOffline(false);

  console.log('\n6) HTTP-Fehler:', fehl.length ? fehl : 'keine');
  console.log('7) JS-Fehler:', errs.length ? errs : 'keine');
  await br.close(); process.exit(0);
})();
