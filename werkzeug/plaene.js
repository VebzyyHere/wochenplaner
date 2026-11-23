/* ============================================================
   Pruefskript Mehrere Plaene (v1.56)

   a) Ohne zweiten Plan: Knopf „Meine Woche", plaene() kennt nur den
      Hauptplan, Raster und Aufgaben wie bisher.
   b) Plan aus Vorlage ueber die Oberflaeche: vier Bereiche mit
      area.kalender, offener Plan je Geraet in localStorage (nie in state),
      Sprung in die Woche von „Ab wann?", Editor zeigt nur die Bereiche des
      Plans und die Bausteine der Vorlage.
   c) Termin im Festival-Plan: in „Meine Woche" kein .block, aber eine
      schraffierte .fremd-Flaeche; die Luecke ist fuer den Verteiler belegt.
   d) Aufgaben und Vorschlagsleiste gelten je Plan.
   e) Umbenennen aendert alle Bereiche des Plans; Loeschen entfernt Bereiche,
      Eintraege und Aufgaben mit Grabstein, offener Plan faellt zurueck.
   f) migrate() saeubert area.kalender wertbasiert; mergeStates() traegt es mit.
   g) Telefon 360 px: Plan-Knopf erst ab zwei Plaenen; Kopf passt mit ihm und „Heute", Blatt ohne
      waagerechtes Scrollen.
   h) keine Konsolenfehler.

   Feste Uhr: Mittwoch 2026-11-25, 10:20 Europe/Berlin.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const konsolenfehler = [];
  const seite = async (opt) => {
    const ctx = await br.newContext({ timezoneId: 'Europe/Berlin', locale: 'de-DE', ...opt });
    const p = await ctx.newPage();
    p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });
    await p.clock.setFixedTime(new Date('2026-11-25T10:20:00+01:00'));
    await p.goto(F);
    await p.waitForTimeout(500);
    await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
    return p;
  };
  const basis = p => p.evaluate(() => {
    try { localStorage.removeItem('wochenplaner.local.plan'); } catch (e) {}
    state = freshState(); migrate(state);
    state.profile.name = 'Test';
    state.areas.forEach(a => { a.plan.goal = 0; });
    state.areas[2].plan.goal = 3;
    state.blocks = [
      { id: 'm1', title: 'Arbeit', areaId: 'a1', day: 2, date: '2026-11-25', repeat: 'none', start: 540, end: 720, grob: false, frog: false },
      { id: 'm2', title: 'Kino', areaId: 'a6', day: 5, date: '2026-11-28', repeat: 'none', start: 1140, end: 1260, grob: false, frog: false }
    ];
    state.tasks = [{ id: 't1', title: 'Steuer', areaId: 'a7', done: false, frog: false }];
    anchor = new Date(); selectedDayIdx = 2;
    planMerken(null); save(); renderAll();
  });

  const p = await seite({ viewport: { width: 1440, height: 900 } });
  console.log('=== a) Nur „Meine Woche" ===');
  await basis(p);
  const a = await p.evaluate(() => ({ knopf: document.querySelector('#planBtn').textContent, n: plaene().length,
    bloecke: document.querySelectorAll('#grid .block:not(.is-sug)').length, fremd: document.querySelectorAll('#grid .fremd').length,
    aufgaben: document.querySelectorAll('#taskList .task').length }));
  ok(a.knopf.includes('Meine Woche') && a.n === 1, 'a) Knopf „Meine Woche", ein Plan');
  ok(a.bloecke === 2 && a.fremd === 0, 'a) Raster wie bisher: 2 Bloecke, nichts schraffiert');

  console.log('=== b) Plan aus Vorlage ===');
  await p.click('#planBtn');
  await p.waitForSelector('.planvorlage');
  await p.click('.planvorlage >> nth=0');
  await p.fill('#pnName', 'Rock am See');
  await p.fill('#pnAb', '2026-12-04');
  await p.click('#pnOk');
  await p.waitForTimeout(300);
  const b = await p.evaluate(() => {
    const neu = state.areas.filter(x => x.kalender);
    return { n: neu.length, namen: neu.map(x => x.name).join(), id: aktiverPlan, gleich: new Set(neu.map(x => x.kalender.id)).size,
      gespeichert: localStorage.getItem('wochenplaner.local.plan'), imState: JSON.stringify(state).includes('aktiverPlan'),
      woche: iso(mondayOf(anchor)), knopf: document.querySelector('#planBtn').textContent, ziele: neu.every(x => x.plan.goal === 0),
      ideen: neu.reduce((s, x) => s + (x.ideen || []).length, 0) };
  });
  ok(b.n === 4 && b.gleich === 1 && b.namen === 'Bühnen & Acts,Food & Drinks,Camp & Chill,Anreise & Orga', 'b) vier Bereiche mit gemeinsamem Plan: ' + b.namen);
  ok(b.id && b.gespeichert === b.id && !b.imState, 'b) offener Plan im Geraet gemerkt, nicht im Zustand');
  ok(b.woche === '2026-11-30' && b.knopf.includes('Rock am See'), 'b) Sprung in die Woche ab 4.12., Knopf zeigt den Plan');
  ok(b.ziele && b.ideen >= 4, 'b) keine erfundenen Wochenziele, Bausteine im Ideenglas');
  await p.evaluate(() => newBlock(4, '2026-12-04', 1140, 1200));
  await p.waitForSelector('#bAreas .chip');
  const b2 = await p.evaluate(() => ({ chips: [...document.querySelectorAll('#bAreas .chip')].map(c => c.textContent).join(),
    bausteine: (document.querySelector('#bLieblingeRow') || { textContent: '' }).textContent }));
  ok(b2.chips === 'Bühnen & Acts,Food & Drinks,Camp & Chill,Anreise & Orga', 'b) Editor zeigt nur die Bereiche des Plans');
  ok(b2.bausteine.startsWith('Bausteine') && b2.bausteine.includes('Mainstage Headliner · 2 h'), 'b) Bausteine der Vorlage: ' + b2.bausteine.slice(0, 60));
  await p.evaluate(() => closeModal());

  console.log('=== c) Termine anderer Plaene ===');
  await p.evaluate(() => {
    const acts = state.areas.find(x => x.name === 'Bühnen & Acts');
    state.blocks.push({ id: 'f1', title: 'Headliner', areaId: acts.id, day: 2, date: '2026-11-25', repeat: 'none', start: 840, end: 960, grob: false, frog: false });
    save(); anchor = new Date(); renderAll();
  });
  let c = await p.evaluate(() => ({ bloecke: [...document.querySelectorAll('#grid .block')].map(x => x.dataset.id).join(), fremd: document.querySelectorAll('#grid .fremd').length }));
  ok(c.bloecke === 'f1' && c.fremd === 2, 'c) im Festival-Plan: eigener Block, zwei schraffierte aus „Meine Woche"');
  await p.click('#planBtn');
  await p.click('.planzeile__wahl >> nth=0');
  await p.waitForTimeout(200);
  c = await p.evaluate(() => {
    const f = [...document.querySelectorAll('#grid .fremd')];
    const tag = weekDays().find(d => d.key === '2026-11-25');
    const luecken = freeGaps(tag, state.areas[2].plan, state.areas[2]);
    return { aktiv: aktiverPlan, bloecke: [...document.querySelectorAll('#grid .block:not(.is-sug)')].map(x => x.dataset.id).sort().join(),
      fremd: f.map(x => x.textContent).join(), klickbar: f.every(x => getComputedStyle(x).pointerEvents === 'none'),
      frei1415: luecken.some(g => g.start < 960 && g.end > 840) };
  });
  ok(c.aktiv === null && c.bloecke === 'm1,m2', 'c) zurueck in „Meine Woche": nur die eigenen Bloecke');
  ok(c.fremd.includes('Rock am See') && c.klickbar, 'c) Festival-Termin schraffiert mit Planname, nicht bedienbar');
  ok(!c.frei1415, 'c) die Festival-Zeit ist fuer den Verteiler belegt');

  console.log('=== d) Aufgaben und Vorschlaege je Plan ===');
  await p.evaluate(() => { buildSuggestions(); save(); setView('aufgaben'); renderAll(); });
  const d1 = await p.evaluate(() => ({ aufgaben: document.querySelectorAll('#taskList .task').length, sug: document.body.dataset.sugbar,
    nSug: state.blocks.filter(b => b.sug).length }));
  await p.evaluate(() => { planWechseln(plaene()[1].id); });
  const d2 = await p.evaluate(() => ({ aufgaben: document.querySelectorAll('#taskList .task').length, leer: !!document.querySelector('#taskList .empty'),
    sugbar: (document.querySelector('#sugBar').textContent || '').trim() }));
  ok(d1.aufgaben === 1 && d2.aufgaben === 0 && d2.leer, 'd) Aufgabe nur in „Meine Woche"');
  ok(d1.nSug > 0 && d2.sugbar === '', 'd) Vorschlagsleiste im Festival-Plan leer (Vorschlaege gehoeren zu „Meine Woche")');

  console.log('=== e) Umbenennen und Loeschen ===');
  await p.click('#planBtn');
  await p.click('.planzeile >> nth=1 >> text=Umbenennen');
  await p.fill('.planzeile input[aria-label="Name des Plans"]', 'Seefest');
  await p.click('.planzeile >> text=Speichern');
  await p.waitForTimeout(150);
  const e1 = await p.evaluate(() => state.areas.filter(x => x.kalender).map(x => x.kalender.name).join());
  ok(e1 === 'Seefest,Seefest,Seefest,Seefest', 'e) Umbenennen trifft alle vier Bereiche');
  await p.click('.planzeile >> nth=1 >> text=Löschen');
  await p.waitForTimeout(250);
  const text = await p.evaluate(() => [...document.querySelectorAll('.sheet p')].map(x => x.textContent).join(' '));
  ok(text.includes('4 Bereiche') && text.includes('1 Eintrag'), 'e) Rueckfrage nennt, was verschwindet: ' + text.slice(0, 70));
  await p.click('.sheet .btn--danger:has-text("Plan löschen"), .sheet button:has-text("Plan löschen")');
  await p.waitForTimeout(250);
  const e2 = await p.evaluate(() => ({ n: plaene().length, aktiv: aktiverPlan, f1: state.blocks.some(b => b.id === 'f1'), grab: !!state.tombs.f1,
    bereiche: state.areas.length, gespeichert: localStorage.getItem('wochenplaner.local.plan') }));
  ok(e2.n === 1 && e2.aktiv === null && !e2.f1 && e2.grab && e2.bereiche === 7 && !e2.gespeichert, 'e) Plan weg, Eintrag mit Grabstein, zurueck in „Meine Woche"');
  await p.evaluate(() => closeModal());

  console.log('=== f) migrate und Abgleich ===');
  const f = await p.evaluate(() => {
    const s = freshState();
    s.areas[0].kalender = 5;
    s.areas[1].kalender = { id: ' x ', name: '', emoji: '🎪🎪🎪🎪🎪🎪' };
    migrate(s); const m1 = JSON.stringify([s.areas[0].kalender, s.areas[1].kalender]);
    migrate(s); const m2 = JSON.stringify([s.areas[0].kalender, s.areas[1].kalender]);
    const mine = freshState(); migrate(mine);
    const theirs = JSON.parse(JSON.stringify(mine));
    theirs.areas.push({ id: 'neu', name: 'Genuss', hue: 75, plan: defaultPlan(), kalender: { id: 'p-r', name: 'Reise', emoji: '✈️' }, at: Date.now() });
    const out = mergeStates(mine, theirs);
    return { m1, gleich: m1 === m2, merge: JSON.stringify((out.areas.find(a => a.id === 'neu') || {}).kalender) };
  });
  ok(f.m1 === '[null,{"id":"x","name":"Plan","emoji":"🎪🎪🎪🎪"}]', 'f) kaputtes Feld entfernt, Name/Symbol gesaeubert: ' + f.m1);
  ok(f.gleich, 'f) migrate() ist idempotent');
  ok(f.merge === '{"id":"p-r","name":"Reise","emoji":"✈️"}', 'f) mergeStates traegt den Plan mit dem Bereich mit');

  console.log('=== g) Telefon 360 px ===');
  const t = await seite({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await basis(t);
  ok(await t.evaluate(() => getComputedStyle(document.querySelector('#planBtn')).display === 'none'), 'g) mit nur einem Plan steht am Telefon kein Plan-Knopf im Kopf');
  await t.evaluate(() => { planAnlegen(PLAN_VORLAGEN[1], 'Reise', '✈️', null); save(); anchor = addDays(new Date(), 7); renderAll(); });
  const g = await t.evaluate(() => {
    const k = document.querySelector('.topbar'), r = e => e.getBoundingClientRect();
    const sichtbar = [...k.querySelectorAll('button')].filter(x => x.offsetParent);
    let overlap = false;
    sichtbar.forEach((x, i) => sichtbar.slice(i + 1).forEach(y => { const A = r(x), B = r(y); if (A.left < B.right - 1 && B.left < A.right - 1 && A.top < B.bottom - 1 && B.top < A.bottom - 1) overlap = true; }));
    return { sw: k.scrollWidth, cw: k.clientWidth, heute: !document.querySelector('#todayBtn').hidden, plan: r(document.querySelector('#planBtn')).width, overlap,
      rechts: Math.max(...sichtbar.map(x => r(x).right)) };
  });
  ok(g.heute && g.plan >= 44 && g.sw <= g.cw && !g.overlap && g.rechts <= 360, 'g) Kopf passt mit Plan-Knopf und „Heute" (' + JSON.stringify(g) + ')');
  await t.tap('#planBtn');
  await t.waitForSelector('.planvorlage');
  await t.tap('.planvorlage >> nth=2');
  await t.waitForTimeout(200);
  const g2 = await t.evaluate(() => ({ scroll: document.querySelector('.sheet').scrollWidth - document.querySelector('.sheet').clientWidth, doc: document.documentElement.scrollWidth }));
  ok(g2.scroll <= 1 && g2.doc <= 360, 'g) Plan-Studio ohne waagerechtes Scrollen');
  if (process.env.WP_BILD) await t.screenshot({ path: path.join(process.env.WP_BILD, 'planstudio-handy.png') });

  console.log('=== h) Konsole ===');
  ok(konsolenfehler.length === 0, 'h) keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));
  await br.close();
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nALLES GRUEN');
  process.exit(fehler.length ? 1 : 0);
})();
