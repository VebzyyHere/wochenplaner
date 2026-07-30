const { chromium, devices } = require('playwright');
const path = require('path');
(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(450);
  await p.evaluate(() => closeModal());

  // Ungleich verteilte Woche: Montag voll, Mittwoch leer, Sonntag frei
  await p.evaluate(() => {
    const mon = mondayOf(anchor);
    const add = (t, a, d, s, e) => state.blocks.push({ id: uid(), title: t, areaId: a,
      day: d, date: iso(addDays(mon, d)), repeat: "none", start: s, end: e, frog: false, grob: false });
    state.settings.dayStart = 6; state.settings.dayEnd = 23;
    state.settings.sleep = { on: true, from: 22 * 60 + 30, to: 6 * 60 + 30, wind: 30 };
    add("Arbeit", "a1", 0, 8 * 60, 18 * 60);        // Montag: 10 h, deutlich über der Marke
    add("Abendtermin", "a6", 0, 19 * 60, 21 * 60);
    add("Arbeit", "a1", 1, 9 * 60, 15 * 60);        // Dienstag: 6 h
    add("Sport", "a3", 3, 18 * 60, 19 * 60);        // Donnerstag: 1 h
    // Mittwoch bleibt leer
    dayMeta(iso(addDays(mon, 6))).frei = true;      // Sonntag frei
    save(); renderAll();
  });
  await p.waitForTimeout(350);

  const balken = await p.evaluate(() => {
    return [...document.querySelectorAll('.dayswitch__btn')].map((b, i) => ({
      tag: DAY_SHORT[i],
      fuellung: b.style.getPropertyValue('--last'),
      voll: b.classList.contains('is-voll'),
      frei: b.classList.contains('is-frei'),
      titel: b.title.split('· ')[1]
    }));
  });
  console.log('1) Balken je Tag:');
  balken.forEach(x => console.log('   ' + JSON.stringify(x)));

  const mass = await p.evaluate(() => {
    const a = tagesAuslastung({ key: iso(mondayOf(anchor)), i: 0 });
    return { montagMin: a.min, grenze: Math.round(a.grenze), quote: Math.round(a.quote * 100) / 100 };
  });
  console.log('2) Maßstab Montag:', JSON.stringify(mass));

  // Vorschläge müssen den Balken sofort bewegen
  const vorher = await p.evaluate(() => [...document.querySelectorAll('.dayswitch__btn')]
    .map(b => b.style.getPropertyValue('--last')).join(' '));
  await p.evaluate(() => {
    state.areas.find(a => a.id === "a2").plan.goal = 10;
    save(); buildSuggestions(); save(); renderAll();
  });
  await p.waitForTimeout(300);
  const nachher = await p.evaluate(() => [...document.querySelectorAll('.dayswitch__btn')]
    .map(b => b.style.getPropertyValue('--last')).join(' '));
  console.log('3) Vor dem Verteilen: ', vorher);
  console.log('   Nach dem Verteilen:', nachher, vorher !== nachher ? '→ bewegt sich' : '→ UNVERÄNDERT');

  // Größe und Sichtbarkeit
  const geo = await p.evaluate(() => {
    const b = document.querySelector('.dayswitch__btn');
    const i = b.querySelector('i');
    const r = i.getBoundingClientRect();
    return { balkenBreite: Math.round(r.width), balkenHoehe: Math.round(r.height),
             knopfHoehe: Math.round(b.getBoundingClientRect().height),
             leisteHoehe: Math.round(document.querySelector('.dayswitch').getBoundingClientRect().height),
             quer: (() => { const d = document.querySelector('.dayswitch');
               return d.scrollWidth > d.clientWidth + 1; })() };
  });
  console.log('4) Maße:', JSON.stringify(geo));

  await p.screenshot({ path: 'w-balken.png' });
  await p.evaluate(() => { state.settings.theme = 'dark'; applyTheme(); });
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'w-balken-dunkel.png' });

  console.log('\nFehler:', errs.length ? errs : 'keine');
  await br.close();
})();
