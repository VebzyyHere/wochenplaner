/* ============================================================
   Pruefskript Ideen wuerfeln (v1.48)

   a) Fenster: ideeFenster() nennt nur Luecken ab jetzt, mindestens 30 min,
      Start auf Viertelstunden; vergangene Tage und ein freigehaltener Tag
      liefern keine.
   b) Wurf: jede gewuerfelte Idee liegt ganz in einer freien Luecke und
      ueberschneidet keinen Eintrag; keine Idee beginnt vor 9 Uhr, Abend-
      Ideen („ab") nicht vor 18 Uhr; „Nochmal" bringt nie dieselbe Idee direkt wieder. 200 Wuerfe.
   c) Blatt: Knopf oeffnet „Idee fuer freie Zeit"; nichts wird gespeichert,
      weder beim Oeffnen noch bei „Nochmal wuerfeln" noch bei „Schliessen".
   d) „Einplanen" oeffnet den Editor als neuen Eintrag, vorausgefuellt mit
      Titel, Tag und Zeit; gespeichert wird erst mit dem Fussknopf.
   e) Volle Woche: das Blatt sagt, dass kein Fenster offen ist, ohne
      „Einplanen".
   f) Telefon: Knopf 44 px, Blatt ohne waagerechtes Scrollen, Fuss sichtbar.
   g) keine Konsolenfehler.

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
  const basis = (p, bloecke, freiTag) => p.evaluate(([bl, frei]) => {
    state = freshState(); migrate(state);
    state.profile.name = 'Test';
    state.areas.forEach(a => { a.plan.goal = 0; });
    state.blocks = bl.map((b, i) => ({ id: 'i' + i, title: 'Eintrag ' + i, repeat: 'none', areaId: state.areas[0].id, ...b }));
    if (frei) dayMeta(frei).frei = true;
    migrate(state);
    anchor = new Date(); selectedDayIdx = 2;
    save(); setView('plan'); renderAll();
  }, [bloecke, freiTag || null]);

  // Mo 3.8. bis So 9.8.2026, heute Mi 5.8. 10:00
  const PLAN = [
    { date: '2026-08-05', start: 600, end: 720 },   // Mi 10–12
    { date: '2026-08-05', start: 840, end: 1020 },  // Mi 14–17
    { date: '2026-08-06', start: 480, end: 1050 },  // Do 8–17:30
    { date: '2026-08-07', start: 540, end: 780 },   // Fr 9–13
  ];

  console.log('=== a) Fenster ===');
  const p = await seite({ viewport: { width: 1440, height: 900 } });
  await basis(p, PLAN, '2026-08-08');
  const a = await p.evaluate(() => ideeFenster().map(f => ({ key: f.day.key, start: f.start, end: f.end })));
  ok(a.length > 0 && a.every(f => f.key >= '2026-08-05'), 'a) nur heute und spaeter (' + a.length + ' Fenster)');
  ok(a.every(f => f.end - f.start >= 30 && f.start % 15 === 0), 'a) mindestens 30 min, Start auf Viertelstunden');
  ok(!a.some(f => f.key === '2026-08-08'), 'a) der freigehaltene Samstag liefert kein Fenster');
  ok(a.filter(f => f.key === '2026-08-05').every(f => f.start >= 600), 'a) heute nichts vor jetzt');

  console.log('=== b) Wurf ===');
  const b = await p.evaluate(() => {
    const vorher = JSON.stringify(state);
    let letzte = null; const probleme = []; const titel = new Set();
    for (let n = 0; n < 200; n++) {
      const w = ideeWuerfeln(letzte);
      if (!w) { probleme.push('kein Wurf'); break; }
      if (letzte && w.idee === letzte) probleme.push('Wiederholung ' + w.idee.t);
      if (w.end - w.start !== w.idee.min) probleme.push('Dauer ' + w.idee.t);
      if (w.start < (w.idee.ab || 540)) probleme.push('zu frueh ' + w.idee.t + ' ' + w.start);
      const drin = freeGaps(w.day, {}, null, {}).some(g => g.start <= w.start && g.end >= w.end);
      if (!drin) probleme.push('nicht in Luecke ' + w.idee.t + ' ' + w.day.key + ' ' + w.start);
      const kollision = state.blocks.some(x => !x.grob && onDay(x, w.day.key, w.day.i) && x.start < w.end && x.end > w.start);
      if (kollision) probleme.push('Kollision ' + w.day.key + ' ' + w.start);
      if (!state.areas.includes(w.area)) probleme.push('Bereich');
      titel.add(w.idee.t); letzte = w.idee;
    }
    return { probleme: probleme.slice(0, 5), verschiedene: titel.size, gleich: vorher === JSON.stringify(state) };
  });
  ok(b.probleme.length === 0, 'b) 200 Wuerfe: alle in einer Luecke, keine Kollision, Abend-Ideen ab 18 Uhr, keine direkte Wiederholung' + (b.probleme.length ? ' — ' + b.probleme.join('; ') : ''));
  ok(b.verschiedene >= 8, 'b) ' + b.verschiedene + ' verschiedene Ideen');
  ok(b.gleich, 'b) Wuerfeln aendert state nicht');

  console.log('=== c) Blatt ===');
  const vorher = await p.evaluate(() => JSON.stringify(state));
  await p.click('#wuerfelBtn');
  await p.waitForSelector('.idee__titel');
  const c1 = await p.evaluate(() => ({ titel: document.querySelector('.sheet__title').textContent, idee: document.querySelector('.idee__titel').textContent, wann: document.querySelector('.idee__wann').textContent }));
  ok(c1.titel === 'Idee für freie Zeit' && c1.idee.length > 3 && /\d{2}:\d{2}–\d{2}:\d{2}/.test(c1.wann), 'c) Blatt zeigt „' + c1.idee + '" · ' + c1.wann);
  await p.click('#ideeNochmal');
  await p.waitForTimeout(100);
  const c2 = await p.evaluate(() => document.querySelector('.idee__titel').textContent);
  ok(c2 !== c1.idee, 'c) „Nochmal wuerfeln" zeigt eine andere Idee („' + c2 + '")');
  await p.click('.sheet__foot .btn:has-text("Schließen")');
  await p.waitForTimeout(200);
  ok(await p.evaluate(v => JSON.stringify(state) === v && !document.querySelector('.idee'), vorher), 'c) nach Schliessen ist nichts gespeichert');

  console.log('=== d) Einplanen ===');
  await p.click('#wuerfelBtn');
  await p.waitForSelector('.idee__titel');
  const d0 = await p.evaluate(() => ({ idee: document.querySelector('.idee__titel').textContent, wann: document.querySelector('.idee__wann').textContent, n: state.blocks.length }));
  await p.click('#ideePlanen');
  await p.waitForSelector('#bTitle');
  const d1 = await p.evaluate(() => ({ kopf: document.querySelector('.sheet__title').textContent, titel: document.querySelector('#bTitle').value,
    von: document.querySelector('#bFrom').value, bis: document.querySelector('#bTo').value, n: state.blocks.length, oft: !!document.querySelector('#bLieblingeRow') }));
  ok(d1.kopf === 'Neuer Eintrag' && d1.titel === d0.idee && d0.wann.includes(d1.von + '–' + d1.bis) && !d1.oft, 'd) Editor vorausgefuellt: „' + d1.titel + '" ' + d1.von + '–' + d1.bis);
  ok(d1.n === d0.n, 'd) vor dem Fussknopf nichts gespeichert');
  await p.click('.sheet__foot .btn--primary');
  await p.waitForTimeout(300);
  const d2 = await p.evaluate(() => { const x = state.blocks[state.blocks.length - 1]; return { n: state.blocks.length, t: x.title, sug: !!x.sug }; });
  ok(d2.n === d0.n + 1 && d2.t === d0.idee && !d2.sug, 'd) Fussknopf speichert genau einen festen Eintrag');

  console.log('=== e) Volle Woche ===');
  await basis(p, ['2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09'].map(date => ({ date, start: 0, end: 1440 })));
  await p.click('#wuerfelBtn');
  await p.waitForSelector('.idee__leer');
  const e = await p.evaluate(() => ({ text: document.querySelector('.idee__leer').textContent, planen: document.querySelector('#ideePlanen').hidden, nochmal: document.querySelector('#ideeNochmal').hidden }));
  ok(e.text.includes('kein freies Fenster') && e.planen && e.nochmal, 'e) „' + e.text + '", ohne „Einplanen"');
  await p.evaluate(() => closeModal());

  console.log('=== f) Telefon ===');
  const t = await seite({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await basis(t, PLAN);
  const f1 = await t.evaluate(() => { const r = document.querySelector('#wuerfelBtn').getBoundingClientRect(); return { w: r.width, h: r.height, rechts: r.right, quer: document.documentElement.scrollWidth }; });
  ok(f1.w >= 44 && f1.h >= 44 && f1.rechts <= 320 && f1.quer <= 320, 'f) Knopf ' + Math.round(f1.w) + ' × ' + Math.round(f1.h) + ' px, innerhalb der Breite');
  await t.tap('#wuerfelBtn');
  await t.waitForSelector('.idee__titel');
  await t.waitForTimeout(500);
  const f2 = await t.evaluate(() => { const s = document.querySelector('.sheet'), fu = document.querySelector('.sheet__foot').getBoundingClientRect();
    return { quer: s.scrollWidth > s.clientWidth + 1, fuss: fu.bottom <= window.innerHeight + 1 && fu.top >= 0 }; });
  ok(!f2.quer && f2.fuss, 'f) Blatt ohne waagerechtes Scrollen, Fuss sichtbar');

  console.log('=== g) Konsole ===');
  ok(konsolenfehler.length === 0, 'g) keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));

  await br.close();
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nALLES GRUEN');
  process.exit(fehler.length ? 1 : 0);
})();
