const { chromium, devices } = require('playwright');
const path = require('path');
(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const errs = [];
  const ctx = await br.newContext({ ...devices['iPhone SE'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  // Abgleich mit echten Zeitstempeln
  const mg = await p.evaluate(() => {
    const now = Date.now();
    const mk = () => JSON.parse(JSON.stringify(state));
    const a = mk(), b = mk();
    a.erledigt["x|2026-01-01"] = { on: true,  at: now - 60000 };
    b.erledigt["x|2026-01-01"] = { on: false, at: now };
    b.rituale["2026-01-05"] = 5000;
    const m1 = mergeStates(a, b), m2 = mergeStates(b, a);
    // altes "doch nicht" wird weggeraeumt, altes "erledigt" bleibt
    const c = mk();
    c.erledigt["alt|2020-01-01"] = { on: false, at: now - 200*86400000 };
    c.erledigt["alt2|2020-01-01"] = { on: true, at: now - 200*86400000 };
    const m3 = mergeStates(c, {});
    return {
      neuerGewinnt: m1.erledigt["x|2026-01-01"].on,
      andersRum: m2.erledigt["x|2026-01-01"].on,
      ritual: m1.rituale["2026-01-05"],
      altesNein: "alt|2020-01-01" in m3.erledigt,
      altesJa: "alt2|2020-01-01" in m3.erledigt
    };
  });
  console.log('1) Abgleich:', JSON.stringify(mg));

  // Ritual-Karte am Handy
  await p.evaluate(() => {
    const mon = mondayOf(anchor), vor = addDays(mon,-7);
    for (let i=0;i<4;i++) state.blocks.push({ id: uid(), title: "Lernen", areaId: "a2",
      day: i, date: iso(addDays(vor,i)), repeat: "none", start: 14*60, end: 16*60, frog: false });
    state.areas.find(a=>a.id==="a2").plan.goal = 10;
    delete state.rituale[iso(mon)];
    save();
    // Fälligkeit erzwingen, um die Karte zu sehen
    window.ritualFaellig = () => true;
    renderAll();
  });
  await p.waitForTimeout(300);
  const karte = await p.evaluate(() => {
    setView('ziele');
    const c = document.getElementById('ritualCard');
    const r = c.getBoundingClientRect();
    return { hidden: c.hidden, breite: Math.round(r.width), hoehe: Math.round(r.height),
             text: c.textContent.slice(0,90),
             knopfHoehe: Math.round(c.querySelector('button').getBoundingClientRect().height) };
  });
  console.log('2) Ritualkarte iPhone SE:', JSON.stringify(karte));
  await p.screenshot({ path: 'rt2-karte-se.png', fullPage: true });

  await p.click('#ritualCard button:has-text("Wochenstart")');
  await p.waitForTimeout(400);
  const sheet = await p.evaluate(() => {
    const s = document.querySelector('.sheet');
    const r = s.getBoundingClientRect();
    const foot = s.querySelector('.sheet__foot').getBoundingClientRect();
    const klein = [...s.querySelectorAll('button, input[type=checkbox]')]
      .map(b => ({ n: (b.textContent||b.id||'cb').trim().slice(0,14), h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) }))
      .filter(x => x.h > 0 && (x.h < 40 || x.w < 30));
    return { sheetHoehe: Math.round(r.height), fensterHoehe: window.innerHeight,
             footSichtbar: foot.bottom <= window.innerHeight + 1, footUnten: Math.round(foot.bottom),
             querScroll: s.scrollWidth > s.clientWidth + 1, zuKlein: klein };
  });
  console.log('3) Ritual-Dialog iPhone SE:', JSON.stringify(sheet));
  await p.screenshot({ path: 'rt3-ritual-se.png' });

  // durchklicken am Handy
  await p.click('.sheet__foot button:has-text("Weiter")');
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'rt4-ziele-se.png' });
  const st2 = await p.evaluate(() => {
    const s = document.querySelector('.sheet');
    const klein = [...s.querySelectorAll('.stepper button')].map(b=>Math.round(b.getBoundingClientRect().height));
    return { zeilen: s.querySelectorAll('.zielrow').length, stepperHoehen: [...new Set(klein)],
             querScroll: s.scrollWidth > s.clientWidth + 1 };
  });
  console.log('4) Schritt 2 am Handy:', JSON.stringify(st2));
  await p.click('.sheet__foot button:has-text("Weiter")');
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'rt5-verteilen-se.png' });
  await p.click('.sheet__foot button:has-text("Fertig")');
  await p.waitForTimeout(400);

  console.log('\nFehler:', errs.length ? errs : 'keine');
  await br.close();
})();
