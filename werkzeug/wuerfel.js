/* ============================================================
   Pruefskript Ideen wuerfeln (v1.49)

   a) Fenster: ideeFenster() nennt nur Luecken ab jetzt, mindestens 15 min,
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
   h) Ideenglas: „Ins Glas legen" speichert genau area.ideen am gewaehlten
      Bereich; leerer Text und Doppeltes werden abgelehnt; Nutzertext mit
      Markup bleibt Text; die eigene Idee wird gewuerfelt und nutzt ihren
      Bereich; migrate() saeubert Unsinn und ist idempotent; mergeStates()
      behaelt das Feld; Herausnehmen loescht es wieder; Telefon ohne
      waagerechtes Scrollen.

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
  ok(a.every(f => f.end - f.start >= 15 && f.start % 15 === 0), 'a) mindestens 15 min, Start auf Viertelstunden');
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

  console.log('=== h) Ideenglas ===');
  await basis(p, PLAN);
  await p.click('#wuerfelBtn');
  await p.waitForSelector('#ideeNeuAuf');
  const h0 = await p.evaluate(() => ({ glas: document.querySelector('#ideenglasRow').hidden, form: document.querySelector('#ideeNeuForm').hidden }));
  ok(h0.glas && h0.form, 'h) leeres Glas und Formular sind anfangs verborgen');
  await p.click('#ideeNeuAuf');
  await p.click('#ideeNeuOk');
  ok(await p.evaluate(() => !document.querySelector('#ideeNeuFehler').hidden && !state.areas.some(a => a.ideen)), 'h) leerer Text wird abgelehnt, nichts gespeichert');
  await p.fill('#ideeNeuText', 'serienabend');
  await p.click('#ideeNeuOk');
  ok(await p.evaluate(() => document.querySelector('#ideeNeuFehler').textContent.includes('schon im Glas') && !state.areas.some(a => a.ideen)), 'h) eine Idee, die es schon gibt, wird abgelehnt');
  await p.fill('#ideeNeuText', '<b>Schwimmen</b> gehen');
  await p.click('#ideeNeuDauer .chip:has-text("1,5 h")');
  await p.click('#ideeNeuBereich .chip >> nth=1');
  await p.click('#ideeNeuOk');
  await p.waitForTimeout(150);
  const h1 = await p.evaluate(() => {
    const mit = state.areas.filter(a => a.ideen);
    const chip = document.querySelector('.ideenglas__chip');
    return { n: mit.length, id: mit[0] && mit[0].id, zweiter: state.areas[1].id, ideen: mit[0] && JSON.stringify(mit[0].ideen),
      chip: chip && chip.textContent, fett: !!document.querySelector('.ideenglas b'),
      gespeichert: JSON.stringify(Store.load().areas[1].ideen || null), wurzel: 'ideen' in state };
  });
  ok(h1.n === 1 && h1.id === h1.zweiter && h1.ideen === '[{"t":"<b>Schwimmen</b> gehen","min":90}]' && !h1.wurzel, 'h) gespeichert genau am gewaehlten Bereich: ' + h1.ideen);
  ok(h1.gespeichert === h1.ideen, 'h) liegt auch im Speicher');
  ok(h1.chip && h1.chip.includes('<b>Schwimmen</b> gehen') && !h1.fett, 'h) Nutzertext erscheint als Text, nicht als Markup („' + h1.chip + '")');
  const h2 = await p.evaluate(() => {
    let treffer = null;
    for (let n = 0; n < 400 && !treffer; n++) { const w = ideeWuerfeln(null); if (w && w.idee.areaId) treffer = w; }
    return treffer && { t: treffer.idee.t, dauer: treffer.end - treffer.start, bereich: treffer.area.id === state.areas[1].id };
  });
  ok(h2 && h2.dauer === 90 && h2.bereich, 'h) die eigene Idee wird gewuerfelt, 90 min, in ihrem Bereich');
  const h3 = await p.evaluate(() => {
    const s = JSON.parse(JSON.stringify(state));
    s.areas[0].ideen = [null, { t: '   ' }, { t: 'x'.repeat(200), min: 'abc' }, { t: ' Kino ', min: 9999 }, { t: 'Tee', min: 7 }];
    s.areas[2].ideen = 'kaputt';
    migrate(s);
    const eins = JSON.stringify(s.areas.map(a => a.ideen || null));
    migrate(s);
    const zwei = JSON.stringify(s.areas.map(a => a.ideen || null));
    const i = s.areas[0].ideen;
    const fremd = JSON.parse(JSON.stringify(state)); fremd.areas[1].ideen = [];  delete fremd.areas[1].ideen;
    const m = mergeStates(JSON.parse(JSON.stringify(state)), fremd);
    return { idem: eins === zwei, n: i.length, lang: i[0].t.length, min0: i[0].min, kino: i[1].t + '/' + i[1].min, tee: i[2].min,
      kaputt: s.areas[2].ideen === undefined, merge: JSON.stringify((m.areas || m.state.areas)[1].ideen || null) };
  });
  ok(h3.idem && h3.n === 3 && h3.lang === 60 && h3.min0 === 60 && h3.kino === 'Kino/240' && h3.tee === 15 && h3.kaputt, 'h) migrate() saeubert (Leeres weg, 60 Zeichen, 15–240 min) und ist idempotent');
  ok(h3.merge === h1.ideen, 'h) mergeStates() behaelt die Ideen des neueren Stands');
  const h5 = await p.evaluate(() => {
    const uni = () => alleIdeen().filter(i => i.nurMit);
    const mit = uni().length, ziel = ideeBereich(uni()[0]).name, anruf = ideeBereich(IDEEN.find(i => i.t.startsWith('Jemanden anrufen'))).name;
    const merk = state.areas[1].name; state.areas[1].name = 'Garten';
    const ohne = uni().length; state.areas[1].name = merk;
    return { mit, ohne, ziel, anruf };
  });
  ok(h5.mit === 1 && h5.ohne === 0 && h5.ziel === 'Uni & Lernen' && h5.anruf === 'Menschen', 'h) Uni-Idee nur mit Uni-Bereich und dort eingeplant; Anruf landet bei „' + h5.anruf + '"');
  await p.click('.ideenglas__chip');
  await p.waitForTimeout(100);
  ok(await p.evaluate(() => !state.areas.some(a => 'ideen' in a) && document.querySelector('#ideenglasRow').hidden && !Store.load().areas.some(a => a.ideen)), 'h) Herausnehmen loescht das Feld wieder');
  await p.evaluate(() => closeModal());
  await t.evaluate(() => closeModal());
  await t.waitForTimeout(500);
  await t.evaluate(() => { state.areas[0].ideen = [{ t: 'Eine ziemlich lange eigene Idee fuer den Sonntagnachmittag', min: 120 }]; save(); });
  await t.tap('#wuerfelBtn');
  await t.waitForSelector('#ideeNeuAuf');
  await t.tap('#ideeNeuAuf');
  await t.waitForTimeout(400);
  const h4 = await t.evaluate(() => { const s = document.querySelector('.sheet'); const r = document.querySelector('#ideeNeuAuf').getBoundingClientRect();
    return { quer: s.scrollWidth > s.clientWidth + 1, seite: document.documentElement.scrollWidth, h: r.height }; });
  ok(!h4.quer && h4.seite <= 320 && h4.h >= 44, 'h) Telefon: Glas und Formular ohne waagerechtes Scrollen, Knopf ' + Math.round(h4.h) + ' px hoch');

  console.log('=== g) Konsole ===');
  ok(konsolenfehler.length === 0, 'g) keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));

  await br.close();
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nALLES GRUEN');
  process.exit(fehler.length ? 1 : 0);
})();
