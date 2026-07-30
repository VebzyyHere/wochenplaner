const { chromium, devices } = require('playwright');
const path = require('path');
const LIST = ['iPhone SE','iPhone 13','iPhone 14 Pro Max','iPad (gen 7)','iPad Pro 11'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  for (const name of LIST) {
    const d = devices[name];
    if (!d) { console.log('unbekannt:', name); continue; }
    const c = await b.newContext({ ...d });
    const p = await c.newPage();
    await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await p.waitForTimeout(450);
    const go = p.locator('button:has-text("Los geht\'s")');
    if (await go.count()) { await go.click({ timeout: 5000 }).catch(()=>{}); await p.waitForTimeout(200); }
    const m = await p.evaluate(() => {
      const small = [];
      document.querySelectorAll('button, .chip, .task__check').forEach(el => {
        const q = el.getBoundingClientRect();
        if (q.width > 0 && (q.height < 40 || q.width < 36)) {
          small.push((el.id || el.className.toString().split(' ')[0] || el.textContent.trim()).slice(0,20) + ` ${Math.round(q.width)}x${Math.round(q.height)}`);
        }
      });
      return { vp: window.innerWidth + 'x' + window.innerHeight,
               coarse: matchMedia('(pointer: coarse)').matches,
               raster: Math.round((document.querySelector('.gridwrap')||{getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height),
               klein: [...new Set(small)] };
    });
    console.log(`\n### ${name}  ${m.vp}  coarse=${m.coarse}  raster=${m.raster}`);
    console.log('  zu klein:', m.klein.length ? m.klein.join(' | ') : 'keine');
    await c.close();
  }
  await b.close();
})();
