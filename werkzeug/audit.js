const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const mess = () => {
  const s = document.querySelector('.sheet');
  const R = el => el.getBoundingClientRect();
  const klein = [];
  const wurzel = s || document.body;
  wurzel.querySelectorAll('button, .chip, input, select, [role=button], label.switch').forEach(b => {
    const q = R(b); if (!q.width || b.type === 'hidden') return;
    const lab = b.closest('label');
    const h = lab ? Math.max(q.height, R(lab).height) : q.height;
    if (h < 43.5 || q.width < 23) klein.push(((b.id || b.textContent || b.className || '?') + '').trim().slice(0,20) + ` ${Math.round(q.width)}x${Math.round(h)}`);
  });
  // Abgeschnittener Text
  const clip = [];
  wurzel.querySelectorAll('*').forEach(e => {
    if (e.children.length) return;
    if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible') clip.push((e.textContent||'').trim().slice(0,26));
  });
  const out = {
    querScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    zuKlein: [...new Set(klein)].slice(0,10),
    abgeschnitten: [...new Set(clip)].slice(0,6)
  };
  if (s) {
    const f = s.querySelector('.sheet__foot');
    out.sheet = { hoehe: Math.round(R(s).height), fenster: window.innerHeight,
      obenAb: Math.round(R(s).top),
      footSichtbar: f ? R(f).bottom <= window.innerHeight + 1 : null,
      scrollbar: s.scrollHeight > s.clientHeight + 1,
      querScrollImSheet: s.scrollWidth > s.clientWidth + 1 };
  }
  return out;
};

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone SE'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.goto(F); await p.waitForTimeout(500);

  const zeig = async (name, shot) => {
    const m = await p.evaluate(mess);
    const flag = (m.querScroll ? ' ⚠QUER' : '') + (m.sheet && m.sheet.footSichtbar === false ? ' ⚠FOOT' : '')
      + (m.sheet && m.sheet.querScrollImSheet ? ' ⚠SHEETQUER' : '') + (m.abgeschnitten.length ? ' ⚠CLIP' : '')
      + (m.zuKlein.length ? ' ⚠KLEIN' : '');
    console.log(`\n## ${name}${flag}`);
    console.log('   ' + JSON.stringify(m));
    if (shot) await p.screenshot({ path: `au-${shot}.png` });
  };

  // Onboarding
  for (const [i,n] of [[0,'hallo'],[1,'schlaf'],[2,'fest'],[3,'ziele']]) {
    if (i) { await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(280); }
    await zeig('Onboarding ' + n, 'ob-' + n);
  }
  await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(900);

  // Vorwoche + Aufgaben fuellen
  await p.evaluate(() => {
    const mon = mondayOf(anchor), vor = addDays(mon,-7);
    for (let i=0;i<4;i++) state.blocks.push({ id: uid(), title: "Lernen fuer Statistik", areaId: "a2",
      day: i, date: iso(addDays(vor,i)), repeat: "none", start: 14*60, end: 16*60, frog: false, grob: false });
    state.tasks.push({ id: uid(), title: "Hausarbeit Kapitel 3 fertig schreiben", areaId: "a2", done: false, frog: true });
    state.tasks.push({ id: uid(), title: "Einkaufen", areaId: "a7", done: false, frog: false });
    state.tasks.push({ id: uid(), title: "Zahnarzt anrufen", areaId: "a7", done: true, frog: false });
    state.areas.find(a=>a.id==="a2").plan.goal = 12;
    save(); renderAll();
  });
  await p.waitForTimeout(300);

  for (const v of ['plan','ziele','aufgaben','heute']) {
    await p.evaluate(x => setView(x), v); await p.waitForTimeout(300);
    await zeig('Ansicht ' + v, 'v-' + v);
  }

  // Dialoge
  await p.evaluate(() => setView('plan'));
  await p.waitForTimeout(200);
  await p.click('#fabAdd'); await p.waitForTimeout(400);
  await zeig('Eintrag neu', 'd-neu');
  await p.evaluate(() => { document.querySelector('#bGenau button:last-child').click(); });
  await p.waitForTimeout(300);
  await zeig('Eintrag grob', 'd-grob');
  await p.evaluate(() => closeModal());

  await p.evaluate(() => { const b = state.blocks.find(x=>!x.sug&&!x.grob); blockSheet(Object.assign({},b), b.date); });
  await p.waitForTimeout(400); await zeig('Eintrag bearbeiten', 'd-edit');
  await p.evaluate(() => closeModal());

  await p.evaluate(() => goalsSheet()); await p.waitForTimeout(400);
  await zeig('Ziele', 'd-ziele'); await p.evaluate(() => closeModal());

  await p.evaluate(() => ritualSheet()); await p.waitForTimeout(400);
  await zeig('Ritual 1', 'd-rit1');
  await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(300);
  await zeig('Ritual 2', 'd-rit2');
  await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(300);
  await zeig('Ritual 3', 'd-rit3');
  await p.evaluate(() => closeModal());

  await p.click('#settingsBtn'); await p.waitForTimeout(400);
  await zeig('Einstellungen Menue', 'd-set');
  const seiten = await p.evaluate(() => [...document.querySelectorAll('.setmenu__item')].map(x=>x.textContent.trim().slice(0,18)));
  console.log('   Seiten:', JSON.stringify(seiten));
  for (let i=0;i<seiten.length;i++) {
    await p.evaluate(n => document.querySelectorAll('.setmenu__item')[n].click(), i);
    await p.waitForTimeout(300);
    await zeig('Einstellungen: ' + seiten[i], 'd-set' + i);
    const zur = p.locator('.setback');
    if (await zur.count()) { await zur.click(); await p.waitForTimeout(250); }
  }
  await p.evaluate(() => closeModal());

  await p.click('#syncBadge'); await p.waitForTimeout(400);
  await zeig('Anmelden', 'd-login'); await p.evaluate(() => closeModal());

  await p.evaluate(() => { state.days[currentDayIso()] = { energy: 'low' };
    state.areas.forEach(a => a.plan.must = false); save(); renderAll(); relieveSheet(); });
  await p.waitForTimeout(400); await zeig('Was kann weg', 'd-relief');
  await p.evaluate(() => closeModal());

  await p.evaluate(() => { const b = state.blocks.find(x=>!x.sug&&!x.grob); moveSheet(b.id); });
  await p.waitForTimeout(400); await zeig('Verschieben', 'd-move');
  await p.evaluate(() => closeModal());

  console.log('\n=== Fehler:', errs.length ? errs : 'keine');
  await br.close();
})();
