const { chromium, devices } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(600);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  const geste = (dx, dy) => p.evaluate(async ({dx, dy}) => {
    const el = document.querySelector('.gridwrap');
    const r = el.getBoundingClientRect();
    const x = r.left + r.width/2, y = r.top + r.height/2;
    const ev = (typ, cx, cy, ziel) => (ziel||el).dispatchEvent(new PointerEvent(typ, {
      pointerId:1, pointerType:'touch', isPrimary:true, bubbles:true, cancelable:true, clientX:cx, clientY:cy }));
    ev('pointerdown', x, y);
    for (let i=1;i<=6;i++) { ev('pointermove', x + dx*i/6, y + dy*i/6); await new Promise(r=>setTimeout(r,10)); }
    ev('pointerup', x+dx, y+dy);
    await new Promise(r=>setTimeout(r,300));
    return { tag: DAY_SHORT[selectedDayIdx], woche: isoWeek(mondayOf(anchor)) };
  }, {dx, dy});

  const start = await p.evaluate(() => ({ tag: DAY_SHORT[selectedDayIdx], woche: isoWeek(mondayOf(anchor)) }));
  console.log('Start:                    ', JSON.stringify(start));
  console.log('Wischen nach links (-120): ', JSON.stringify(await geste(-120, 0)), '→ ein Tag weiter');
  console.log('Nochmal links:             ', JSON.stringify(await geste(-120, 0)));
  console.log('Wischen nach rechts (+120):', JSON.stringify(await geste(120, 0)), '→ ein Tag zurück');
  console.log('Senkrecht wischen (Scroll):', JSON.stringify(await geste(0, -140)), '→ darf sich NICHT ändern');
  console.log('Kurzes Wackeln (30px):     ', JSON.stringify(await geste(-30, 0)), '→ darf sich NICHT ändern');
  // Über den Wochenrand
  await p.evaluate(() => { selectedDayIdx = 6; renderAll(); });
  console.log('Von Sonntag nach links:    ', JSON.stringify(await geste(-120, 0)), '→ Montag der Folgewoche');
  await p.evaluate(() => { selectedDayIdx = 0; renderAll(); });
  console.log('Von Montag nach rechts:    ', JSON.stringify(await geste(120, 0)), '→ Sonntag der Vorwoche');

  // Longpress darf weiter funktionieren
  const lp = await p.evaluate(async () => {
    const el = document.querySelector('.daycol');
    const r = el.getBoundingClientRect();
    const x = r.left + r.width/2, y = r.top + 120;
    el.dispatchEvent(new PointerEvent('pointerdown', {pointerId:1,pointerType:'touch',isPrimary:true,bubbles:true,cancelable:true,clientX:x,clientY:y}));
    await new Promise(r=>setTimeout(r,520));
    document.dispatchEvent(new PointerEvent('pointerup', {pointerId:1,pointerType:'touch',bubbles:true,clientX:x,clientY:y}));
    await new Promise(r=>setTimeout(r,250));
    return !!document.querySelector('.sheet');
  });
  console.log('\nLanges Druecken legt noch an:', lp, '(soll: true)');
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
