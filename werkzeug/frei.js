const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const p = await br.newPage({ viewport: { width: 1400, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(500);
  // Onboarding durchklicken
  for (let i=0;i<4;i++) { await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(300); }
  await p.waitForTimeout(400);

  const vorher = await p.evaluate(() => {
    // Sonntag anwaehlen
    selectedDayIdx = 6; renderAll();
    const key = currentDayIso();
    return { tag: key, vorschlaegeDort: state.blocks.filter(b=>b.sug&&onDay(b,key,6)).length,
             frei: istFrei(key), schalter: document.getElementById('dayFrei').checked };
  });
  console.log('1) Sonntag vorher:', JSON.stringify(vorher));

  await p.click('#dayFrei');
  await p.waitForTimeout(400);
  const nachher = await p.evaluate(() => {
    const key = currentDayIso();
    return { frei: istFrei(key), label: document.getElementById('dayFreiLab').textContent,
             vorschlaegeDort: state.blocks.filter(b=>b.sug&&onDay(b,key,6)).length,
             kopfFrei: !!document.querySelector('.dayhead.is-frei'),
             spalteFrei: document.querySelectorAll('.daycol.is-frei').length,
             chipFrei: !!document.querySelector('.dayswitch__btn.is-frei'),
             toast: (document.querySelector('.toast')||{}).textContent };
  });
  console.log('2) Sonntag frei:', JSON.stringify(nachher));

  // Neu verteilen: darf den freien Tag nicht anfassen
  const neu = await p.evaluate(() => {
    clearSuggestions();
    state.areas.forEach(a => { if (a.plan.goal) a.plan.goal += 4; });
    const r = buildSuggestions();
    const key = currentDayIso();
    return { gesetzt: state.blocks.filter(b=>b.sug).length,
             amFreienTag: state.blocks.filter(b=>b.sug&&onDay(b,key,6)).length,
             verteiltAuf: [...new Set(state.blocks.filter(b=>b.sug).map(b=>b.date))].sort() };
  });
  console.log('3) Neu verteilt:', JSON.stringify(neu));

  // Von Hand eintragen bleibt erlaubt
  const hand = await p.evaluate(() => {
    const key = currentDayIso();
    state.blocks.push({ id: "handarbeit", title: "Brunch", areaId: "a6", day: 6,
      date: key, repeat: "none", start: 11*60, end: 13*60, frog: false, grob: false });
    save(); renderAll();
    return { drin: state.blocks.some(b=>b.id==="handarbeit"),
             sichtbar: [...document.querySelectorAll('.block__title')].some(x=>x.textContent==='Brunch') };
  });
  console.log('4) Von Hand eintragen:', JSON.stringify(hand));

  // Wieder freigeben
  await p.click('#dayFrei');
  await p.waitForTimeout(300);
  const zurueck = await p.evaluate(() => {
    const key = currentDayIso();
    return { frei: istFrei(key), imState: JSON.stringify(state.days[key]||{}),
             kopfFrei: !!document.querySelector('.dayhead.is-frei') };
  });
  console.log('5) Wieder verplanbar:', JSON.stringify(zurueck));

  await p.evaluate(() => { selectedDayIdx = 6; dayMeta(currentDayIso()).frei = true; save(); renderAll(); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'frei-desktop.png' });
  console.log('\nFehler:', errs.length ? errs : 'keine');
  await br.close();
})();
