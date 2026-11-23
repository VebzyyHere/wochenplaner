/* ============================================================
   Pruefskript Lieblingssteine (v1.48) — „Oft geplant" im neuen Eintrag

   a) Ableitung: lieblingsSteine() nennt nur, was mindestens zweimal im
      Plan steht (gleicher Titel im selben Bereich, Gross/Klein egal); eine
      Serie zaehlt doppelt; Vorschlaege, Ganztaegiges und Eintraege ohne
      Titel zaehlen nicht; hoechstens fuenf; haeufigste zuerst; die Form
      kommt vom juengsten Eintrag. state bleibt unveraendert.
   b) Leerer Plan: der neue Eintrag zeigt keine Zeile „Oft geplant".
   c) Neuer Eintrag: die Zeile steht vor „Was?", ein Tipp fuellt Titel,
      Bereich und Dauer; gespeichert wird erst mit dem Fussknopf.
   d) Grober Lieblingsstein: der Editor steht danach auf „ungefaehr".
   e) Bestehender Eintrag und Kopie zeigen die Zeile nicht.
   f) Nutzertext: ein Titel mit <b> wird als Text gezeigt.
   g) iPhone SE: kein waagerechtes Scrollen, Chips mindestens 44 px hoch.
   h) keine Konsolenfehler.

   Feste Uhr: Mittwoch 2026-08-05, 10:00 Europe/Berlin.
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
    await p.clock.setFixedTime(new Date('2026-08-05T10:00:00+02:00'));
    await p.goto(F);
    await p.waitForTimeout(500);
    await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
    return p;
  };
  const basis = (p, bloecke) => p.evaluate(bl => {
    state = freshState(); migrate(state);
    state.profile.name = 'Test';
    state.areas.forEach(a => { a.plan.goal = 0; });
    const A = state.areas;
    state.blocks = bl.map((b, i) => ({ id: 'l' + i, repeat: 'none', ...b, areaId: A[b.bereich].id }));
    migrate(state);
    anchor = new Date(); selectedDayIdx = 2;
    save(); renderAll();
  }, bloecke);

  const PLAN = [
    { bereich: 1, title: 'Lernzeit', date: '2026-07-28', start: 840, end: 930 },
    { bereich: 1, title: 'lernzeit', date: '2026-08-04', start: 840, end: 960 },           // juengster: 2 h
    { bereich: 1, title: 'Lernzeit ', date: '2026-07-21', start: 840, end: 900 },
    { bereich: 2, title: 'Laufen', day: 3, since: '2026-07-01', start: 1080, end: 1125, repeat: 'weekly' },  // Serie zaehlt doppelt
    { bereich: 0, title: 'Einmalig', date: '2026-08-03', start: 540, end: 600 },            // nur einmal
    { bereich: 0, title: 'Lernzeit', date: '2026-08-03', start: 600, end: 660 },            // anderer Bereich, einmal
    { bereich: 3, title: 'Musik', date: '2026-07-30', grob: true, teil: 'ab', dauer: 60 },
    { bereich: 3, title: 'Musik', date: '2026-08-06', grob: true, teil: 'ab', dauer: 120 }, // juengster: grob 2 h
    { bereich: 2, title: 'Vorschlag', date: '2026-08-06', start: 600, end: 660, sug: true },
    { bereich: 2, title: 'Vorschlag', date: '2026-08-07', start: 600, end: 660, sug: true },
    { bereich: 2, title: '', date: '2026-08-06', start: 700, end: 760 },
    { bereich: 2, title: '', date: '2026-08-07', start: 700, end: 760 },
  ];

  console.log('=== a) Ableitung ===');
  const p = await seite({ viewport: { width: 1440, height: 900 } });
  await basis(p, PLAN);
  const a = await p.evaluate(() => {
    const vorher = JSON.stringify(state);
    const l = lieblingsSteine();
    return { l: l.map(x => [x.title, state.areas.findIndex(a => a.id === x.areaId), x.dauer, x.grob]), gleich: vorher === JSON.stringify(state) };
  });
  ok(JSON.stringify(a.l) === JSON.stringify([['lernzeit', 1, 120, false], ['Musik', 3, 120, true], ['Laufen', 2, 45, false]]),
    'a) drei Steine: lernzeit 2 h, Musik grob 2 h, Laufen 45 min (ist ' + JSON.stringify(a.l) + ')');
  ok(a.gleich, 'a) die Ableitung aendert state nicht');
  const a5 = await p.evaluate(() => {
    for (let i = 0; i < 8; i++) for (let k = 0; k < 2; k++)
      state.blocks.push({ id: 'x' + i + k, title: 'Viel ' + i, areaId: state.areas[0].id, date: '2026-08-0' + (k + 1), start: 480, end: 540, repeat: 'none' });
    const n = lieblingsSteine().length; state.blocks = state.blocks.filter(b => !b.id.startsWith('x')); return n;
  });
  ok(a5 === 5, 'a) hoechstens fuenf Steine');

  console.log('=== b) Leerer Plan ===');
  await basis(p, []);
  await p.click('#desktopAdd');
  await p.waitForSelector('#bTitle');
  ok(await p.evaluate(() => !document.querySelector('#bLieblingeRow')), 'b) keine Zeile „Oft geplant"');
  await p.evaluate(() => closeModal());

  console.log('=== c) Neuer Eintrag ===');
  await basis(p, PLAN);
  await p.click('#desktopAdd');
  await p.waitForSelector('#bLieblinge .chip');
  const c0 = await p.evaluate(() => {
    const row = document.querySelector('#bLieblingeRow'), was = document.querySelector('#bTitle');
    return { texte: [...document.querySelectorAll('#bLieblinge .chip')].map(x => x.textContent), label: row.querySelector('.label').textContent,
      davor: !!(row.compareDocumentPosition(was) & Node.DOCUMENT_POSITION_FOLLOWING), von: document.querySelector('#bFrom').value, anzahl: state.blocks.length };
  });
  ok(c0.label === 'Oft geplant' && c0.davor, 'c) Zeile „Oft geplant" steht vor „Was?"');
  ok(JSON.stringify(c0.texte) === JSON.stringify(['lernzeit · 2 h', 'Musik · 2 h', 'Laufen · 45 min']), 'c) Chips: ' + c0.texte.join(' | '));
  await p.click('#bLieblinge .chip:nth-child(3)');
  await p.waitForFunction(() => document.querySelector('#bTitle') && document.querySelector('#bTitle').value === 'Laufen');
  const c1 = await p.evaluate(() => {
    const min = v => +v.slice(0, 2) * 60 + +v.slice(3);
    return { von: document.querySelector('#bFrom').value, dauer: min(document.querySelector('#bTo').value) - min(document.querySelector('#bFrom').value),
      bereich: [...document.querySelectorAll('#bAreas .chip')].findIndex(x => x.getAttribute('aria-pressed') === 'true'),
      zeile: !!document.querySelector('#bLieblingeRow'), anzahl: state.blocks.length, titel: document.querySelector('.sheet__title').textContent };
  });
  ok(c1.von === c0.von && c1.dauer === 45 && c1.bereich === 2, 'c) Tipp fuellt Titel, Bereich 3 und 45 min ab ' + c1.von);
  ok(c1.anzahl === c0.anzahl && c1.titel === 'Neuer Eintrag' && !c1.zeile, 'c) noch nichts gespeichert, weiter „Neuer Eintrag"');
  await p.click('.sheet__foot .btn--primary');
  await p.waitForTimeout(300);
  const c2 = await p.evaluate(() => { const b = state.blocks[state.blocks.length - 1]; return { n: state.blocks.length, t: b.title, d: b.end - b.start, date: b.date }; });
  ok(c2.n === c0.anzahl + 1 && c2.t === 'Laufen' && c2.d === 45 && c2.date === '2026-08-05', 'c) Fussknopf speichert genau einen Eintrag „Laufen", 45 min, am gewaehlten Tag');

  console.log('=== d) Grober Lieblingsstein ===');
  await p.evaluate(() => closeModal());
  await p.click('#desktopAdd');
  await p.waitForSelector('#bLieblinge .chip');
  await p.click('#bLieblinge .chip:has-text("Musik")');
  await p.waitForFunction(() => document.querySelector('#bTitle') && document.querySelector('#bTitle').value === 'Musik');
  const d = await p.evaluate(() => ({ grobSichtbar: !document.querySelector('#bGrobRow').hidden, zeitVersteckt: document.querySelector('#bZeitRow').hidden }));
  ok(d.grobSichtbar && d.zeitVersteckt, 'd) Editor steht auf „ungefaehr" (Abschnitt statt Uhrzeit)');
  await p.evaluate(() => closeModal());

  console.log('=== e) Bestehender Eintrag und Kopie ===');
  await p.evaluate(() => editBlock('l0', '2026-07-28'));
  await p.waitForSelector('#bKopie');
  const e1 = await p.evaluate(() => !document.querySelector('#bLieblingeRow'));
  await p.click('#bKopie');
  await p.waitForFunction(() => document.querySelector('.sheet__title') && document.querySelector('.sheet__title').textContent === 'Neuer Eintrag');
  const e2 = await p.evaluate(() => !document.querySelector('#bLieblingeRow'));
  ok(e1 && e2, 'e) weder im Bearbeiten noch in der Kopie');
  await p.evaluate(() => closeModal());

  console.log('=== f) Nutzertext ===');
  await p.evaluate(() => { state.blocks.filter(b => b.title === 'Musik').forEach(b => { b.title = '<b>Fett</b>'; }); });
  await p.click('#desktopAdd');
  await p.waitForSelector('#bLieblinge .chip');
  const f = await p.evaluate(() => ({ b: document.querySelectorAll('#bLieblinge b').length, t: [...document.querySelectorAll('#bLieblinge .chip')].some(x => x.textContent.startsWith('<b>Fett</b>')) }));
  ok(f.b === 0 && f.t, 'f) Titel mit Tags wird als Text gezeigt');
  await p.evaluate(() => closeModal());

  console.log('=== g) iPhone SE ===');
  const t = await seite({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await basis(t, PLAN);
  await t.evaluate(() => { setView('plan'); document.querySelector('#fabAdd').onclick(); });
  await t.waitForSelector('#bLieblinge .chip');
  const g = await t.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    const chips = [...document.querySelectorAll('#bLieblinge .chip')].map(x => x.getBoundingClientRect());
    return { quer: sheet.scrollWidth > sheet.clientWidth + 1 || document.documentElement.scrollWidth > 320,
      hoch: Math.min(...chips.map(r => r.height)), rechts: Math.max(...chips.map(r => r.right)) };
  });
  ok(!g.quer && g.rechts <= 320, 'g) kein waagerechtes Scrollen');
  ok(g.hoch >= 44, 'g) Chips mindestens 44 px hoch (ist ' + g.hoch + ')');

  console.log('=== h) Konsole ===');
  ok(konsolenfehler.length === 0, 'h) keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));

  await br.close();
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nALLES GRUEN');
  process.exit(fehler.length ? 1 : 0);
})();
