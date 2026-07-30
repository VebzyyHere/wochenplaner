const { chromium, devices } = require('playwright');
const path = require('path');
(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone SE'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(450);
  await p.evaluate(() => closeModal());
  await p.evaluate(() => { state.tasks.push({id:'t1',title:'Hausarbeit',areaId:'a2',done:false,frog:false});
    state.tasks.push({id:'t2',title:'Einkaufen',areaId:'a7',done:false,frog:false}); save(); renderAll(); setView('aufgaben'); });
  await p.waitForTimeout(300);

  const zeile = await p.evaluate(() => {
    const r = document.querySelector('.task');
    return { hoehe: Math.round(r.getBoundingClientRect().height),
             knoepfe: [...r.querySelectorAll('button')].map(b=>b.className+' '+Math.round(b.getBoundingClientRect().width)+'x'+Math.round(b.getBoundingClientRect().height)),
             meta: r.querySelector('.task__meta').textContent };
  });
  console.log('1) Zeile:', JSON.stringify(zeile));

  await p.click('.task .task__more'); await p.waitForTimeout(350);
  const blatt = await p.evaluate(() => {
    const s = document.querySelector('.sheet');
    const f = s.querySelector('.sheet__foot').getBoundingClientRect();
    return { titel: s.querySelector('.sheet__title').textContent,
             feld: s.querySelector('#tkTitle').value,
             bereiche: s.querySelectorAll('#tkAreas .chip').length,
             dauern: s.querySelectorAll('#tkDauer .chip').length,
             footSichtbar: f.bottom <= window.innerHeight + 1,
             knoepfe: [...s.querySelectorAll('.sheet__foot button')].map(b=>b.textContent) };
  });
  console.log('2) Blatt:', JSON.stringify(blatt));

  // Titel aendern, Bereich wechseln, Dauer setzen, Stern
  await p.fill('#tkTitle', 'Hausarbeit Kapitel 3');
  await p.evaluate(() => { document.querySelectorAll('#tkAreas .chip')[2].click();
    document.querySelectorAll('#tkDauer .chip')[4].click();
    document.querySelector('#tkFrog').click(); });
  await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(350);
  const nach = await p.evaluate(() => {
    const t = state.tasks.find(x=>x.id==='t1');
    return { titel: t.title, bereich: areaById(t.areaId).name, dauer: t.dauer, stern: t.frog,
             zeile: document.querySelector('.task').textContent,
             tagesform: document.getElementById('energyHint').textContent.indexOf('Das Wichtigste')>=0 };
  });
  console.log('3) Gespeichert:', JSON.stringify(nach));

  // In den Plan legen nimmt die Dauer
  await p.click('.task .task__more'); await p.waitForTimeout(300);
  await p.click('.sheet button:has-text("In den Wochenplan legen")'); await p.waitForTimeout(400);
  const plan = await p.evaluate(() => {
    const s = document.querySelector('.sheet');
    return { titel: s.querySelector('.sheet__title').textContent,
             von: s.querySelector('#bFrom').value, bis: s.querySelector('#bTo').value };
  });
  console.log('4) In den Plan:', JSON.stringify(plan));
  await p.evaluate(() => closeModal());

  // Loeschen
  await p.click('.task .task__more'); await p.waitForTimeout(300);
  await p.click('.sheet__foot .btn--danger'); await p.waitForTimeout(400);
  console.log('5) Nach Löschen:', await p.evaluate(() => ({ anzahl: state.tasks.length,
    rueckgaengig: !!document.querySelector('.toast__act') })));
  console.log('\nFehler:', errs.length ? errs : 'keine');
  await br.close();
})();
