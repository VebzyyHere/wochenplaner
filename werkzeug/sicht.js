// Feste Uhr (Montagmorgen, 2026-08-03T08:00:00+02:00): seit Stufe D kann der
// Erststart-Assistent ein Kapazitaets-Gate oeffnen, ein ungenagelter Lauf
// waere kalendertagabhaengig gruen oder rot.
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');
const FAELLE = [
  ['se-hell',   { ...devices['iPhone SE'] }, 'light'],
  ['13-hell',   { ...devices['iPhone 13'] }, 'light'],
  ['13-dunkel', { ...devices['iPhone 13'] }, 'dark'],
  ['13-quer',   { ...devices['iPhone 13 landscape'] }, 'light'],
];
(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  for (const [tag, dev, theme] of FAELLE) {
    const ctx = await br.newContext({ ...dev, timezoneId: 'Europe/Berlin' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.clock.setFixedTime(new Date('2026-08-03T08:00:00+02:00'));
    await p.goto(F); await p.waitForTimeout(450);
    // Erststart komplett durchklicken
    for (let i=0;i<4;i++) { await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(260); }
    await p.waitForTimeout(600);
    await p.evaluate(th => {
      state.settings.theme = th; applyTheme();
      const mon = mondayOf(anchor), vor = addDays(mon,-7);
      for (let i=0;i<4;i++) state.blocks.push({ id: uid(), title: "Lernen", areaId: "a2",
        day: i, date: iso(addDays(vor,i)), repeat: "none", start: 14*60, end: 16*60, frog:false, grob:false });
      state.tasks.push({ id: uid(), title: "Hausarbeit Kapitel 3 fertig schreiben", areaId:"a2", done:false, frog:true, dauer:90 });
      state.tasks.push({ id: uid(), title: "Einkaufen", areaId:"a7", done:false, frog:false });
      state.areas.find(a=>a.id==="a2").plan.goal = 12;
      dayMeta(iso(addDays(mon,6))).frei = true;
      save(); renderAll();
    }, theme);
    await p.waitForTimeout(400);
    for (const v of ['plan','ziele','aufgaben','heute']) {
      await p.evaluate(x => setView(x), v); await p.waitForTimeout(280);
      await p.screenshot({ path: `s-${tag}-${v}.png` });
    }
    const m = await p.evaluate(() => ({
      quer: document.documentElement.scrollWidth > window.innerWidth + 1,
      dsQuer: (() => { const d=document.querySelector('.dayswitch'); return d.scrollWidth > d.clientWidth+1; })(),
      raster: Math.round(document.querySelector('.gridwrap').getBoundingClientRect().height)
    }));
    console.log(tag, JSON.stringify(m), errs.length ? errs : '');
    await ctx.close();
  }
  await br.close();
})();
