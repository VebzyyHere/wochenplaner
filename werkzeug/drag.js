const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const p = await br.newPage({ viewport: { width: 1400, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(450);
  await p.evaluate(() => closeModal());
  await p.evaluate(() => {
    state.tasks.push({ id: 't1', title: 'Hausarbeit', areaId: 'a2', done: false, frog: false, dauer: 90 });
    save(); renderAll();
  });
  await p.waitForTimeout(300);

  // Aufgabe in das Raster ziehen (echtes HTML5-Ziehen)
  await p.evaluate(() => { document.querySelectorAll('.daycol')[3].id = 'zielSpalte'; });
  await p.dragAndDrop('.task', '#zielSpalte', { targetPosition: { x: 60, y: 200 } });
  await p.waitForTimeout(500);
  // Fallenlassen legt den Block direkt an — kein Dialog, dafuer eine Meldung
  const r = await p.evaluate(() => {
    const b = state.blocks.find(x => x.title === 'Hausarbeit');
    return { blockDa: !!b, zeit: b ? fmtTime(b.start) + '-' + fmtTime(b.end) : null,
             tag: b ? b.day : null, meldung: (document.querySelector('.toast')||{}).textContent,
             ausVersehenBlatt: !!document.querySelector('#tkTitle') };
  });
  console.log('1) Ziehen ins Raster:', JSON.stringify(r));
  await p.evaluate(() => closeModal());
  await p.waitForTimeout(200);

  // Ein einfacher Klick oeffnet das Aufgabenblatt
  await p.click('.task__body');
  await p.waitForTimeout(350);
  console.log('2) Klick auf den Text öffnet das Blatt:',
    await p.evaluate(() => !!document.querySelector('#tkTitle')));
  await p.evaluate(() => closeModal());

  console.log('Fehler:', errs.length ? errs : 'keine');
  await br.close();
})();
