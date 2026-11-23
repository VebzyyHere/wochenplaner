/* ============================================================
   Pruefskript Wochenwaage (v1.49)

   a) Rechnung: wochenWaage() summiert feste Eintraege je Bereich ueber die
      ganze gezeigte Woche; Vorschlaege (sug) zaehlen nicht, Serien einmal
      je Wochentag, grobe Bloecke mit ihrer Dauer. frei = wach - verplant,
      nie negativ. Die Rechnung aendert state nicht.
   b) Desktop: der Balken steht im Rasterkopf neben „Deine Woche", der Kopf
      waechst dadurch nicht (56 px), nichts ueberlappt „+ Eintrag", der
      Text nennt verplant und frei, das aria-label nennt alle Bereiche.
   c) Leere Woche: „Noch nichts verplant", kein Segment.
   d) Nutzertext: ein Bereichsname mit <b> wird als Text gezeigt.
   e) Klick oeffnet das Wochen-Blatt; dort steht die volle Legende und sie
      folgt dem Blaettern im Blatt, ohne anchor zu bewegen.
   f) Telefon: im Rasterkopf unsichtbar, im Wochen-Blatt nur im
      Belegt-Gesicht sichtbar, kein waagerechtes Scrollen.
   g) keine Konsolenfehler.
   h) Filter mit Stunden im Rasterkopf (v1.53).
   i) Wochen-Blatt am Telefon (v1.54): ein Tipp auf einen Bereich der
      Legende blendet in den Tageszeilen alles andere zurueck (nichts in
      state, endet mit dem Blatt); darunter „x von y Eintraegen abgehakt"
      und die offenen Checklisten-Punkte, die sich dort abhaken lassen.

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
    state.blocks = bl.map((b, i) => ({ id: 'w' + i, title: 'Eintrag ' + i, repeat: 'none', ...b, areaId: A[b.bereich].id }));
    migrate(state);
    anchor = new Date(); selectedDayIdx = 2;
    save(); renderAll();
  }, bloecke);

  // Mo 3.8. bis So 9.8.2026
  const WOCHE = [
    { bereich: 0, date: '2026-08-03', start: 540, end: 720 },                       // 3 h Bereich 0
    { bereich: 0, day: 1, since: '2026-08-04', start: 540, end: 660, repeat: 'weekly' }, // 2 h, Serie zaehlt einmal
    { bereich: 1, date: '2026-08-06', start: 840, end: 930 },                       // 1,5 h Bereich 1
    { bereich: 2, date: '2026-08-07', grob: true, teil: 'ab', dauer: 60 },          // 1 h grob Bereich 2
    { bereich: 1, date: '2026-08-08', start: 600, end: 720, sug: true },            // Vorschlag: zaehlt nicht
    { bereich: 1, date: '2026-08-12', start: 600, end: 720 },                       // andere Woche
  ];

  console.log('=== a) Rechnung ===');
  const p = await seite({ viewport: { width: 1440, height: 900 } });
  await basis(p, WOCHE);
  const a = await p.evaluate(() => {
    const vorher = JSON.stringify(state);
    const w = wochenWaage();
    const naechste = wochenWaage(addDays(mondayOf(anchor), 7));
    return { teile: w.teile.map(t => [state.areas.indexOf(t.area), t.min]), verplant: w.verplant, frei: w.frei, wach: w.wach,
      naechste: naechste.teile.map(t => [state.areas.indexOf(t.area), t.min]), gleich: vorher === JSON.stringify(state) };
  });
  ok(JSON.stringify(a.teile) === '[[0,300],[1,90],[2,60]]', 'a) je Bereich: 5 h, 1,5 h, 1 h (ist ' + JSON.stringify(a.teile) + ')');
  ok(a.verplant === 450 && a.frei === a.wach - 450 && a.wach > 450, 'a) verplant 450 min, frei = wach - verplant (' + a.wach + ' wach)');
  ok(JSON.stringify(a.naechste) === '[[0,120],[1,120]]', 'a) naechste Woche: Serie 2 h und der Einzeltermin 2 h (ist ' + JSON.stringify(a.naechste) + ')');
  ok(a.gleich, 'a) die Rechnung aendert state nicht');
  const voll = await p.evaluate(() => {
    state.blocks.push({ id: 'riesig', title: 'Riesig', areaId: state.areas[0].id, date: '2026-08-03', grob: true, teil: 'mo', dauer: 60 * 400, repeat: 'none' });
    const w = wochenWaage(); state.blocks.pop(); return w.frei;
  });
  ok(voll === 0, 'a) ueberplante Woche: frei ist 0, nie negativ');

  console.log('=== b) Desktop ===');
  const b = await p.evaluate(() => {
    const r = e => e.getBoundingClientRect();
    const w = document.querySelector('#waage'), kopf = document.querySelector('.planhead');
    const add = document.querySelector('#desktopAdd'), h1 = kopf.querySelector('h1');
    return { sichtbar: getComputedStyle(w).display !== 'none', kopfH: r(kopf).height, rechts: r(w).right, addLinks: r(add).left,
      h1Rechts: r(h1).right, links: r(w).left, text: w.querySelector('.waage__sum').textContent, label: w.getAttribute('aria-label'),
      segmente: w.querySelectorAll('.waage__bar i:not(.waage__frei)').length, barVersteckt: w.querySelector('.waage__bar').getAttribute('aria-hidden'),
      namen: state.areas.slice(0, 3).map(x => x.name) };
  });
  ok(b.sichtbar && b.segmente === 3, 'b) Balken sichtbar mit 3 Segmenten');
  ok(Math.abs(b.kopfH - 56) < 1, 'b) Rasterkopf bleibt 56 px hoch (ist ' + b.kopfH + ')');
  ok(b.links >= b.h1Rechts && b.rechts <= b.addLinks, 'b) steht zwischen Titel und „+ Eintrag", ohne Ueberlappung');
  ok(/^7,5 h verplant · [\d,]+ h frei$/.test(b.text), 'b) Text: „' + b.text + '"');
  ok(b.barVersteckt === 'true' && b.namen.every(n => b.label.includes(n)) && b.label.includes('7,5 h verplant'), 'b) aria-label nennt Summe und alle Bereiche');

  console.log('=== c) Leere Woche ===');
  await basis(p, []);
  const c = await p.evaluate(() => ({ text: document.querySelector('#waage .waage__sum').textContent, seg: document.querySelectorAll('#waage .waage__bar i:not(.waage__frei)').length }));
  ok(c.text.startsWith('Noch nichts verplant · ') && c.seg === 0, 'c) „' + c.text + '", kein Segment');

  console.log('=== d) Nutzertext ===');
  await basis(p, WOCHE);
  const d = await p.evaluate(() => {
    state.areas[0].name = '<b>Fett</b>'; renderAll();
    const w = document.querySelector('#waage');
    return { kinder: w.querySelectorAll('.waage__item b').length, items: w.querySelectorAll('.waage__item').length, text: w.querySelector('.waage__item').textContent };
  });
  ok(d.kinder === d.items && d.text.includes('<b>Fett</b>'), 'd) Bereichsname mit Tags wird als Text gezeigt');

  console.log('=== e) Wochen-Blatt ===');
  await basis(p, WOCHE);
  await p.click('#waageAuf');
  await p.waitForSelector('#freizeitWaage .waage__sum');
  const e1 = await p.evaluate(() => ({ items: document.querySelectorAll('#freizeitWaage .waage__item').length, text: document.querySelector('#freizeitWaage .waage__sum').textContent, anker: iso(mondayOf(anchor)) }));
  ok(e1.items === 3 && e1.text.startsWith('7,5 h verplant'), 'e) Blatt zeigt die volle Legende (3 Bereiche) und die Summe');
  await p.click('#freizeitNext');
  await p.waitForTimeout(200);
  const e2 = await p.evaluate(() => ({ text: document.querySelector('#freizeitWaage .waage__sum').textContent, anker: iso(mondayOf(anchor)), kopf: document.querySelector('#waage .waage__sum').textContent }));
  ok(e2.text.startsWith('4 h verplant') && e2.anker === e1.anker && e2.kopf.startsWith('7,5 h'), 'e) Blaettern im Blatt: Blatt zeigt 4 h, anchor und Rasterkopf bleiben');
  await p.evaluate(() => closeModal());

  console.log('=== h) Filter mit Stunden ===');
  await basis(p, WOCHE);
  const BILD = process.env.WP_BILD;
  const lage = () => p.evaluate(() => ({
    filter: waageFilter,
    gedrueckt: [...document.querySelectorAll('#waage .waage__item')].map(x => x.getAttribute('aria-pressed')).join(),
    bloecke: [...document.querySelectorAll('.block:not(.is-sug)')].map(x => x.classList.contains('is-gedimmt')),
    lose: [...document.querySelectorAll('.loosechip')].map(x => x.classList.contains('is-gedimmt')),
    kopfH: document.querySelector('.planhead').getBoundingClientRect().height,
    blatt: !!document.querySelector('.sheet'), gespeichert: JSON.stringify(state).includes('waageFilter')
  }));
  let h = await lage();
  ok(h.filter === null && h.gedrueckt === 'false,false,false' && !h.bloecke.some(Boolean), 'h) ohne Filter ist nichts zurueckgeblendet');
  await p.click('#waage .waage__item:nth-child(1)');
  await p.waitForTimeout(150);
  h = await lage();
  ok(h.gedrueckt === 'true,false,false' && !h.blatt, 'h) Tipp auf den ersten Bereich: gedrueckt, kein Blatt');
  ok(h.bloecke.filter(x => !x).length === 2 && h.bloecke.filter(Boolean).length === 1 && h.lose.every(Boolean), 'h) 2 Bloecke des Bereichs bleiben, der Rest (auch der grobe) tritt zurueck: ' + JSON.stringify(h.bloecke) + JSON.stringify(h.lose));
  ok(Math.abs(h.kopfH - 56) < 1 && !h.gespeichert, 'h) Rasterkopf bleibt 56 px, nichts im Zustand');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.matches('#waage .waage__item[aria-pressed="true"]')), 'h) Fokus bleibt auf dem gewaehlten Bereich');
  if (BILD) await p.screenshot({ path: path.join(BILD, 'filter-desktop.png') });
  // Bereich 2 gibt es nur in dieser Woche (der Bereich 0 laeuft als Serie weiter).
  await p.click('#waage .waage__item:nth-child(3)');
  await p.waitForTimeout(100);
  ok((await lage()).filter !== null, 'h) Wechsel auf den dritten Bereich');
  await p.evaluate(() => { anchor = addDays(anchor, 7); renderAll(); });
  h = await lage();
  ok(h.filter === null, 'h) Woche ohne diesen Bereich: Filter endet von selbst');
  await p.evaluate(() => { anchor = new Date(); renderAll(); });
  await p.click('#waage .waage__item:nth-child(2)');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  h = await lage();
  ok(h.filter === null && !h.bloecke.some(Boolean), 'h) derselbe Bereich noch einmal (Tastatur): alles wieder da');

  console.log('=== f) Telefon ===');
  const t = await seite({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await basis(t, WOCHE);
  await t.evaluate(() => setView('plan'));
  const f1 = await t.evaluate(() => getComputedStyle(document.querySelector('#waage')).display);
  ok(f1 === 'none', 'f) im Rasterkopf am Telefon unsichtbar');
  await t.evaluate(() => { freizeitGesicht = 'frei'; freizeitSheet(); });
  await t.waitForSelector('#freizeitWaage', { state: 'attached' });
  const f0 = await t.evaluate(() => getComputedStyle(document.querySelector('#freizeitWaage')).display);
  ok(f0 === 'none', 'f) im Frei-Gesicht bleibt das Blatt wie bisher (Waage verborgen)');
  await t.click('#gesichtUmschalter button:nth-child(2)');
  await t.waitForSelector('#freizeitWaage .waage__sum');
  const f2 = await t.evaluate(() => {
    const w = document.querySelector('#freizeitWaage'), r = w.getBoundingClientRect();
    return { breit: r.width, rechts: r.right, scroll: document.documentElement.scrollWidth, items: [...w.querySelectorAll('.waage__item')].every(i => i.getBoundingClientRect().right <= r.right + 1) };
  });
  ok(f2.breit > 200 && f2.rechts <= 390 && f2.scroll <= 390 && f2.items, 'f) im Wochen-Blatt sichtbar, alles innerhalb der Breite');

  console.log('=== i) Wochen-Blatt: Filter und Abgehakt-Zahl ===');
  await t.evaluate(() => closeModal());
  await basis(t, WOCHE);
  await t.evaluate(() => {
    state.blocks[0].schritte = [{ t: 'Tasche <b>packen</b>', ok: false }, { t: 'Schon fertig', ok: true }];
    state.blocks[1].schritte = [{ t: 'Jede Woche neu', ok: false }];
    setzeErledigt(state.blocks[2], '2026-08-06', true);
    migrate(state); save(); renderAll();
    freizeitGesicht = 'belegt'; freizeitSheet();
  });
  await t.waitForSelector('#freizeitMehr .wochenmehr__zahl');
  const blatt = () => t.evaluate(() => ({
    gedrueckt: [...document.querySelectorAll('#freizeitWaage .waage__item')].map(x => x.getAttribute('aria-pressed')).join(),
    seg: [...document.querySelectorAll('#wochenzeilenListe .wochenzeile__seg:not(.wochenzeile__seg--sug)')].map(x => x.classList.contains('is-gedimmt')),
    zahl: document.querySelector('#freizeitMehr .wochenmehr__zahl').textContent,
    punkte: [...document.querySelectorAll('#freizeitMehr .schritt')].map(x => x.querySelector('span').textContent + ' | ' + x.querySelector('small').textContent),
    fett: document.querySelectorAll('#freizeitMehr .schritt b').length,
    hoehe: Math.min(...[...document.querySelectorAll('#freizeitWaage .waage__item')].map(x => x.getBoundingClientRect().height)),
    scroll: document.documentElement.scrollWidth, gespeichert: JSON.stringify(state).includes('blattFilter')
  }));
  let i1 = await blatt();
  ok(i1.zahl === '1 von 4 Einträgen abgehakt', 'i) „' + i1.zahl + '" (Vorschlag zaehlt nicht)');
  ok(i1.punkte.length === 2 && i1.punkte[0] === 'Tasche <b>packen</b> | Eintrag 0 · Mo' && i1.punkte[1] === 'Jede Woche neu | Eintrag 1 · Di' && i1.fett === 0,
    'i) zwei offene Punkte mit Eintrag und Tag, Nutzertext als Text: ' + JSON.stringify(i1.punkte));
  ok(i1.gedrueckt === 'false,false,false' && !i1.seg.some(Boolean) && i1.hoehe >= 44, 'i) Legende sind Knoepfe mit mindestens 44 px, nichts zurueckgeblendet');
  await t.tap('#freizeitWaage .waage__item:nth-child(1)');
  await t.waitForTimeout(150);
  i1 = await blatt();
  ok(i1.gedrueckt === 'true,false,false' && i1.seg.filter(x => !x).length === 2 && i1.seg.filter(Boolean).length === 2 && !i1.gespeichert && i1.scroll <= 390,
    'i) Tipp auf den ersten Bereich: seine 2 Segmente bleiben, 2 treten zurueck, nichts im Zustand: ' + JSON.stringify(i1.seg));
  if (BILD) await t.screenshot({ path: path.join(BILD, 'blattfilter-handy.png') });
  await t.tap('#freizeitWaage .waage__item:nth-child(1)');
  await t.waitForTimeout(150);
  ok(!(await blatt()).seg.some(Boolean), 'i) noch ein Tipp: alles wieder da');
  await t.tap('#freizeitMehr .schritt:nth-child(1) input');
  await t.waitForTimeout(150);
  const i2 = await t.evaluate(() => ({ ok0: state.blocks[0].schritte[0].ok, ok1: state.blocks[1].schritte[0].ok, offen: wochenMehr().offen.length }));
  ok(i2.ok0 === true && !i2.ok1 && i2.offen === 1, 'i) Punkt im Blatt abgehakt: gespeichert, der andere bleibt offen ' + JSON.stringify(i2));
  await t.evaluate(() => { freizeitGesicht = 'frei'; closeModal(); freizeitSheet(); });
  await t.waitForSelector('#freizeitMehr', { state: 'attached' });
  ok(await t.evaluate(() => document.querySelector('#freizeitMehr').hidden), 'i) im Frei-Gesicht steht davon nichts');
  await t.evaluate(() => { freizeitGesicht = 'belegt'; closeModal(); freizeitSheet(); });
  await t.waitForSelector('#freizeitWaage .waage__item');
  ok((await blatt()).gedrueckt === 'false,false,false', 'i) neu geoeffnetes Blatt startet ohne Filter');
  await t.evaluate(() => { freizeitGesicht = 'frei'; closeModal(); });

  console.log('=== g) Konsole ===');
  ok(konsolenfehler.length === 0, 'g) keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));

  await br.close();
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nALLES GRUEN');
  process.exit(fehler.length ? 1 : 0);
})();
