const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const errs = [];
  const p = await br.newPage({ viewport: { width: 1400, height: 950 } });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  // Vorwoche + diese Woche befuellen
  const setup = await p.evaluate(() => {
    const mon = mondayOf(anchor), vor = addDays(mon, -7);
    const add = (t,a,base,d,s,e,rep) => { const o = { id: uid(), title: t, areaId: a,
      day: d, date: iso(addDays(base,d)), repeat: rep||"none", start: s, end: e, frog: false };
      state.blocks.push(o); return o; };
    // letzte Woche: 3 Uni-Blöcke, 2 Sport
    const u1 = add("Lernen","a2",vor,0,14*60,16*60);
    const u2 = add("Lernen","a2",vor,2,14*60,17*60);
    const u3 = add("Lernen","a2",vor,4,10*60,12*60);
    const s1 = add("Sport","a3",vor,1,18*60,19*60);
    // diese Woche: Arbeit als Serie
    for (let d=0; d<5; d++) add("Arbeit","a1",mon,d,8*60,16*60,"weekly");
    state.areas.find(a=>a.id==="a2").plan.goal = 10;
    state.areas.find(a=>a.id==="a3").plan.goal = 3;
    save(); renderAll();
    return { vorwocheEintraege: wocheEintraege(vor).length, dieseWoche: wocheEintraege(mon).length };
  });
  console.log('1) Aufbau:', JSON.stringify(setup));

  // Ritual erzwingen und durchklicken
  const r1 = await p.evaluate(() => { ritualSheet(); 
    const s = document.querySelector('.sheet');
    return { titel: s.querySelector('.sheet__title').textContent,
             haken: s.querySelectorAll('.hakenrow').length,
             tage: s.querySelectorAll('.hakenliste__tag').length,
             summe: s.querySelector('.hakenkopf__sum').textContent };
  });
  console.log('2) Schritt 1:', JSON.stringify(r1));

  await p.click('.hakenkopf button');
  await p.waitForTimeout(200);
  const r2 = await p.evaluate(() => ({
    summe: document.querySelector('.hakenkopf__sum').textContent,
    knopf: document.querySelector('.hakenkopf button').textContent,
    erledigtEintraege: Object.values(state.erledigt).filter(e=>e.on).length
  }));
  console.log('3) Alle abhaken:', JSON.stringify(r2));

  await p.click('.sheet__foot button:has-text("Weiter")');
  await p.waitForTimeout(250);
  const r3 = await p.evaluate(() => {
    const s = document.querySelector('.sheet');
    return { titel: s.querySelector('.sheet__title').textContent,
             zeilen: s.querySelectorAll('.zielrow').length,
             mitIst: [...s.querySelectorAll('.zielrow__ist')].map(x=>x.textContent),
             ampel: !!s.querySelector('.ampel, [class*=ampel]') };
  });
  console.log('4) Schritt 2:', JSON.stringify(r3));

  // Ziel hochdrehen
  const zeilen = await p.$$('.zielrow');
  const plus = await zeilen[1].$$('.stepper button');
  await plus[1].click(); await p.waitForTimeout(150);
  const r4 = await p.evaluate(() => state.areas.map(a=>a.name+':'+(a.plan.goal||0)).join(' '));
  console.log('5) Stepper:', r4);

  await p.click('.sheet__foot button:has-text("Weiter")');
  await p.waitForTimeout(250);
  const r5 = await p.evaluate(() => {
    const s = document.querySelector('.sheet');
    return { titel: s.querySelector('.sheet__title').textContent,
             lead: s.querySelector('.ritual__lead').textContent.slice(0,60),
             verteilen: !!s.querySelector('button:not(.btn--primary)') , btns: [...s.querySelectorAll('button')].map(b=>b.textContent) };
  });
  console.log('6) Schritt 3:', JSON.stringify(r5));

  const vt = p.locator('.sheet button:has-text("Verteilen")');
  if (await vt.count()) { await vt.click(); await p.waitForTimeout(500); }
  const r6 = await p.evaluate(() => ({ vorschlaege: state.blocks.filter(b=>b.sug).length,
    btns: [...document.querySelectorAll('.sheet button')].map(b=>b.textContent) }));
  console.log('7) Nach Verteilen:', JSON.stringify(r6));

  await p.screenshot({ path: 'rt1-schritt3.png' });
  await p.click('.sheet__foot button:has-text("Fertig")');
  await p.waitForTimeout(400);
  const r7 = await p.evaluate(() => ({
    ritualDone: ritualErledigt(), faellig: ritualFaellig(),
    kartenHidden: document.getElementById('ritualCard').hidden,
    zielNum: [...document.querySelectorAll('.goal__num')].map(x=>x.textContent),
    balken: [...document.querySelectorAll('.goal__track')].map(t=>[...t.children].map(c=>c.style.width).join('|'))
  }));
  console.log('8) Nach Fertig:', JSON.stringify(r7));

  // Serie: Haken nur an einem Tag
  const ser = await p.evaluate(() => {
    const mon = mondayOf(anchor);
    const b = state.blocks.find(x=>x.repeat==="weekly");
    setzeErledigt(b, iso(addDays(mon,0)), true);
    save(); renderAll();
    return { montag: istErledigt(b, iso(addDays(mon,0))),
             dienstag: istErledigt(b, iso(addDays(mon,1))),
             naechsteWoche: istErledigt(b, iso(addDays(mon,7))),
             istArbeit: fmtDur(areaIst("a1")) };
  });
  console.log('9) Serie tageweise:', JSON.stringify(ser));

  // Block-Editor Erledigt-Schalter
  const ed = await p.evaluate(() => {
    const mon = mondayOf(anchor);
    const b = state.blocks.find(x=>x.repeat==="weekly");
    blockSheet(Object.assign({}, b), iso(addDays(mon,1)));
    const box = document.getElementById('bDone');
    return { da: !!box, checked: box && box.checked, hint: document.getElementById('bDoneHint').textContent.slice(0,60) };
  });
  console.log('10) Editor-Schalter:', JSON.stringify(ed));
  await p.evaluate(() => closeModal());

  // Sync-Zusammenfuehrung
  const mg = await p.evaluate(() => {
    const a = JSON.parse(JSON.stringify(state));
    const b = JSON.parse(JSON.stringify(state));
    a.erledigt["x|2026-01-01"] = { on: true, at: 1000 };
    b.erledigt["x|2026-01-01"] = { on: false, at: 2000 };
    b.rituale["2026-01-05"] = 5000;
    const m = mergeStates(a, b);
    const m2 = mergeStates(b, a);
    return { neuerGewinnt: m.erledigt["x|2026-01-01"], andersRum: m2.erledigt["x|2026-01-01"],
             ritual: m.rituale["2026-01-05"] };
  });
  console.log('11) Abgleich:', JSON.stringify(mg));

  // Migration v7 -> v8
  const mig = await p.evaluate(() => {
    const alt = { version: 7, profile:{id:"x",name:""},
      settings:{dayStart:7,dayEnd:22,theme:"auto",sleep:defaultSleep()}, settingsAt:0,
      areas:[{id:"a1",name:"Arbeit",hue:248,plan:defaultPlan()}],
      blocks:[], tasks:[], days:{}, tombs:{}, backupAt:0 };
    migrate(alt);
    return { version: alt.version, erledigt: !!alt.erledigt, rituale: !!alt.rituale };
  });
  console.log('12) Migration v7->v8:', JSON.stringify(mig));

  console.log('\nFehler:', errs.length ? errs : 'keine');
  await br.close();
})();
