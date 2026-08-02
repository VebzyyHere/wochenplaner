/* ============================================================
   Pruefskript Rasterposition je Tag (Stufe 8) — iPhone 13, Eintagesansicht

   Prueft, was der Bericht zu Stufe 8 unter C) "Scrollposition je Tag" ueber
   scrollMerk/scrollMerkSchluessel/scrollSchluessel() behauptet:
     a) Eine gescrollte Position ueberlebt zwei Tabwechsel (weg von 'plan'
        und zurueck, zweimal) unveraendert.
     b) Sie ueberlebt auch einen Minutentakt-Durchlauf (renderGrid() +
        renderAgenda(), wie im setInterval ganz unten in index.html).
     c) "Nie gescrollt" (kein Eintrag in scrollMerk fuer den Tag) landet auf
        der berechneten Startposition (startScroll(hourH), i.d.R. > 0, wenn
        der Tag Eintraege hat) — nicht auf 0.
     d) "Bewusst ganz oben" (scrollTop == 0, tatsaechlich gesetzt) bleibt
        bei 0 stehen und wird NICHT wieder auf die Startposition gezogen.
        Das ist der Unterschied zwischen null (nie gesehen) und 0 (oben),
        den `gemerkt != null ? gemerkt : ...` in renderGrid() herstellt
        (vorher `keepScroll > 0 ? ... : ...` behandelte 0 als falsy).

   Stil wie tap2.js/wisch.js: eine Chromium-Seite, deutsche Ausgabe, Exit 1
   bei Fehlern.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK   ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  // Zwei Tage mit je einem Eintrag zu unterschiedlicher Uhrzeit, damit
  // startScroll(hourH) fuer beide > 0 UND unterschiedlich ist — sonst
  // waeren "nie gescrollt" und "ganz oben" zufaellig gleich (0), oder Tag A
  // und Tag B nicht zu unterscheiden. Beide Uhrzeiten bewusst so gewaehlt,
  // dass ihre Startposition unterhalb der tatsaechlich scrollbaren Hoehe
  // bleibt (die haengt von dayStart/dayEnd ab, nicht von den Eintraegen).
  const basis = await p.evaluate(() => {
    const mon = mondayOf(anchor);
    state.blocks = [];
    state.blocks.push({ id: uid(), title: "Termin A", areaId: "a1", day: 0, date: iso(mon),
      repeat: "none", start: 14 * 60, end: 15 * 60, frog: false });
    state.blocks.push({ id: uid(), title: "Termin B", areaId: "a1", day: 1, date: iso(addDays(mon, 1)),
      repeat: "none", start: 12 * 60, end: 13 * 60, frog: false });
    save();
    selectedDayIdx = 0;
    setView('plan');
    const hourH = parseFloat(getComputedStyle(document.getElementById('grid')).getPropertyValue('--hourh')) || 52;
    const wrap = document.getElementById('gridWrap');
    return { hourH, einTag, startA: startScroll(hourH), maxScroll: wrap.scrollHeight - wrap.clientHeight };
  });
  console.log('Grundlage:', JSON.stringify(basis));
  ok(basis.einTag === true, 'einTag ist an (Eintagesansicht auf iPhone 13)');
  ok(basis.startA > 0, 'startScroll(hourH) fuer Tag A ist > 0 (sonst waere "nie gescrollt" nicht von "oben" zu unterscheiden)');
  ok(basis.startA < basis.maxScroll, 'startScroll(hourH) fuer Tag A liegt innerhalb der scrollbaren Hoehe (sonst wuerde jeder Test-Scroll geklemmt)');

  /* ---- a) + b) Eine gescrollte Position ueberlebt Tabwechsel und Takt ----
     Ziel liegt bewusst zwischen startA und maxScroll — hoch genug, um sich
     von startA zu unterscheiden, aber innerhalb dessen, was der Browser
     tatsaechlich zulaesst (sonst klemmt scrollTop = ZIEL selbst schon auf
     einen anderen Wert, und der Vergleich unten waere gegen die falsche
     Zahl). Der tatsaechlich erreichte Wert (nicht der gewuenschte) ist ab
     hier die Messlatte. */
  const ZIEL = Math.round((basis.startA + basis.maxScroll) / 2);
  await p.evaluate(z => {
    const wrap = document.getElementById('gridWrap');
    wrap.scrollTop = z;
    wrap.dispatchEvent(new Event('scroll'));
  }, ZIEL);
  await p.waitForTimeout(100);

  const nachScroll = await p.evaluate(() => ({
    scrollTop: document.getElementById('gridWrap').scrollTop,
    gemerkt: scrollMerk[scrollSchluessel()]
  }));
  console.log('Nach dem Scrollen:', JSON.stringify(nachScroll));
  ok(nachScroll.scrollTop > basis.startA, 'die Testposition unterscheidet sich tatsaechlich von startScroll(hourH) (kein Deckungsgleich-Zufall)');
  ok(nachScroll.gemerkt === nachScroll.scrollTop, 'scrollMerk hat die gescrollte Position uebernommen (Listener in wischenEinrichten)');
  const IST = nachScroll.scrollTop;

  // Tabwechsel 1: weg und zurueck
  await p.evaluate(() => { setView('ziele'); });
  await p.waitForTimeout(80);
  await p.evaluate(() => { setView('plan'); });
  await p.waitForTimeout(80);
  const nach1 = await p.evaluate(() => document.getElementById('gridWrap').scrollTop);
  ok(nach1 === IST, `Rasterposition ueberlebt Tabwechsel 1 (${nach1} === ${IST})`);

  // Tabwechsel 2: weg und zurueck (ueber eine andere Ansicht)
  await p.evaluate(() => { setView('aufgaben'); });
  await p.waitForTimeout(80);
  await p.evaluate(() => { setView('plan'); });
  await p.waitForTimeout(80);
  const nach2 = await p.evaluate(() => document.getElementById('gridWrap').scrollTop);
  ok(nach2 === IST, `Rasterposition ueberlebt Tabwechsel 2 (${nach2} === ${IST})`);

  // Minutentakt-Durchlauf: derselbe Aufruf wie im setInterval unten in
  // index.html (renderGrid(); renderAgenda();), ohne 60s zu warten.
  await p.evaluate(() => { renderGrid(); renderAgenda(); });
  await p.waitForTimeout(80);
  const nachTakt = await p.evaluate(() => document.getElementById('gridWrap').scrollTop);
  ok(nachTakt === IST, `Rasterposition ueberlebt einen Minutentakt-Durchlauf (${nachTakt} === ${IST})`);

  /* ---- c) "Nie gescrollt" landet auf startScroll(hourH), nicht auf 0 ----
     gemerktVorher MUSS vor dem Wechsel gelesen werden: renderGrid() setzt
     wrap.scrollTop selbst (auf die Startposition), das loest den
     scroll-Listener asynchron aus und schriebe scrollMerk[keyB] — danach
     saehe "nie gescrollt" so aus, als sei sie es nicht mehr gewesen. */
  const keyB = await p.evaluate(() => {
    const mon = mondayOf(anchor);
    return iso(addDays(mon, 1));
  });
  const gemerktVorher = await p.evaluate(k => scrollMerk[k], keyB);
  ok(gemerktVorher === undefined, 'Tag B stand vor dem Besuch nicht in scrollMerk (nie gesehen)');

  await p.evaluate(() => { selectedDayIdx = 1; setView('plan'); });
  await p.waitForTimeout(100);
  const tagB = await p.evaluate(() => ({
    scrollTop: document.getElementById('gridWrap').scrollTop,
    erwartet: startScroll(parseFloat(getComputedStyle(document.getElementById('grid')).getPropertyValue('--hourh')) || 52)
  }));
  console.log('Tag B, nie gescrollt:', JSON.stringify(tagB));
  ok(Math.abs(tagB.scrollTop - tagB.erwartet) < 1, `"nie gescrollt" landet auf der berechneten Startposition, nicht auf 0 (${tagB.scrollTop} ≈ ${tagB.erwartet})`);
  ok(tagB.erwartet > 0, 'zur Kontrolle: die berechnete Startposition fuer Tag B ist selbst > 0');

  /* ---- d) "Bewusst ganz oben" (0) bleibt 0, wird nicht zu startScroll ---- */
  await p.evaluate(() => {
    const wrap = document.getElementById('gridWrap');
    wrap.scrollTop = 0;
    wrap.dispatchEvent(new Event('scroll'));
  });
  await p.waitForTimeout(100);
  const nullGemerkt = await p.evaluate(() => scrollMerk[scrollSchluessel()]);
  ok(nullGemerkt === 0, `scrollMerk speichert 0 tatsaechlich als 0, nicht als "nichts" (gemerkt: ${JSON.stringify(nullGemerkt)})`);

  // Tabwechsel weg und zurueck — 0 darf NICHT wieder zu startScroll(hourH)
  // hochspringen (das war der Bug: "keepScroll > 0 ? ... : ..." behandelte
  // 0 als falsy).
  await p.evaluate(() => { setView('heute'); });
  await p.waitForTimeout(80);
  await p.evaluate(() => { setView('plan'); });
  await p.waitForTimeout(80);
  const nachNull = await p.evaluate(() => document.getElementById('gridWrap').scrollTop);
  ok(nachNull === 0, `"ganz oben" bleibt nach Tabwechsel bei 0 stehen, statt zur Startposition zurueckzuspringen (${nachNull} === 0)`);

  console.log('\n=== Konsolenfehler:', errs.length ? errs : 'keine');
  fehler.push(...errs);
  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  await br.close();
  process.exit(fehler.length ? 1 : 0);
})();
