const { chromium, devices } = require('../werkzeug/node_modules/playwright');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
(async () => {
  const br = await chromium.launch({executablePath:process.env.WP_CHROMIUM});
  try {
    const ctx = await br.newContext({...devices['iPhone 13'],deviceScaleFactor:1,timezoneId:'Europe/Berlin'});
    const p = await ctx.newPage(); const external=[],errors=[];
    p.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:8902/')) external.push(r.url()); });
    p.on('pageerror', e=>errors.push(e.message));
    await p.goto('http://127.0.0.1:8902/beispiel');
    await p.waitForFunction(()=>syncSettled);
    await p.evaluate(()=>localStorage.setItem('wochenplaner.local','Vorschau-Schutzprobe'));
    await p.locator('#tabbar [data-view="aufgaben"]').click();
    await p.locator('#taskInput').fill('Nur in dieser Vorschau');
    await p.locator('#taskForm button').click();
    assert.ok(await p.evaluate(()=>state.tasks.some(t=>t.title==='Nur in dieser Vorschau')));
    assert.equal(await p.evaluate(()=>localStorage.getItem('wochenplaner.local')),'Vorschau-Schutzprobe');
    await p.reload(); await p.waitForFunction(()=>syncSettled);
    assert.ok(await p.evaluate(()=>!state.tasks.some(t=>t.title==='Nur in dieser Vorschau')));
    assert.equal(await p.evaluate(()=>localStorage.getItem('wochenplaner.local')),'Vorschau-Schutzprobe');
    assert.equal(await p.evaluate(()=>Sync.configured()),false);
    assert.deepEqual(external,[]); assert.deepEqual(errors,[]);
    assert.equal(await p.evaluate(async()=> (await navigator.serviceWorker.getRegistrations()).length),0);
    await p.screenshot({path:path.resolve(__dirname,'vorschau-iphone.png')});
    const actual = await ctx.request.get('http://127.0.0.1:8902/');
    assert.equal(await actual.text(),fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8'));
    const traversal = await ctx.request.get('http://127.0.0.1:8902/%2e%2e%2fCLAUDE.md');
    assert.equal(traversal.status(),404);
    console.log('Vorschau geprüft: echte App unverändert ausgeliefert; Beispieldaten flüchtig, lokaler Bestand unberührt, kein Cloudzugriff, kein Service Worker, keine JavaScript-Fehler, kein Zugriff außerhalb des Projekts.');
    await ctx.close();
  } finally { await br.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
