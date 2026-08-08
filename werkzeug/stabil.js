/* ============================================================
   Pruefskript Stabil (Stufe 11) — der Verteiler bleibt ruhig.

   a) Zweimal hintereinander verteilen, ohne etwas zu aendern: kein
      einziger Vorschlag bewegt sich (Tag und Startzeit bleiben gleich,
      kein Block verschwindet, keiner entsteht neu).
   b) Ein neuer Termin am Donnerstag, dann neu verteilen: nur Donnerstag
      aendert sich, alle anderen Tage bleiben Block fuer Block identisch.
      Um das wirklich zu erzwingen (statt auf Zufall zu hoffen), liegt
      der neue Termin exakt auf einem bestehenden Donnerstags-Vorschlag.
   c) Der laufende Tag (heute) wird beim Neuverteilen nicht angetastet —
      selbst wenn sein harter Filter absichtlich gebrochen wird (Tag im
      Testlauf freigehalten).
   d) Ein von Hand gezogener Block (block.fix) bleibt liegen, auch wenn
      sein harter Filter bricht und auch nach zweimal Verteilen.

   a)+b) laufen in der Zukunftswoche wie realtest.js, damit "heute" dort
   keine Rolle spielt — das ist Sache von c). Stil wie regeln.js/
   wunsch.js: eine Chromium-Seite, deutsche Ausgabe, Exit 1 bei Fehlern.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

// Vergleicht zwei Schnappschuesse (Array von {id,date,start,...}) nach id:
// bewegt = id in beiden vorhanden, aber date/start unterschiedlich.
function vergleiche(vorher, nachher) {
  const v = Object.fromEntries(vorher.map(b => [b.id, b]));
  const n = Object.fromEntries(nachher.map(b => [b.id, b]));
  const bewegt = [], verschwunden = [], neu = [];
  Object.keys(v).forEach(id => {
    if (!n[id]) { verschwunden.push(id); return; }
    if (v[id].date !== n[id].date || v[id].start !== n[id].start) bewegt.push(id);
  });
  Object.keys(n).forEach(id => { if (!v[id]) neu.push(id); });
  return { bewegt, verschwunden, neu };
}

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const p = await br.newPage({ viewport: { width: 1400, height: 950 } });
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  // -------------------------------------------------------------
  // a) + b): gemeinsamer Aufbau, exakt die Eingabe aus realtest.js.
  // -------------------------------------------------------------
  const ab = await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: true, from: 22 * 60 + 30, to: 6 * 60 + 30, wind: 30 };
    const set = (id, h, must, pad) => { const a = state.areas.find(x => x.id === id);
      a.plan.goal = h; a.plan.must = must; if (pad !== undefined) a.plan.pad = pad; };
    set("a1", 20, true, 60);   // Arbeit, Wegzeit 60
    set("a2", 12, true);       // Uni
    set("a3", 4, true);        // Sport
    set("a6", 4, true);        // Menschen
    set("a5", 8, false);       // Freizeit als Kür
    anchor = addDays(mondayOf(new Date()), 7);   // Zukunftswoche, "heute" spielt hier keine Rolle
    state.blocks = [];
    save(); renderAll();

    const schnappschuss = () => state.blocks
      .filter(b => b.sug && !b.grob)
      .map(b => ({ id: b.id, areaId: b.areaId, date: b.date, start: b.start, end: b.end }));

    // Runde 1: aus dem Leeren verteilen.
    buildSuggestions();
    const runde1 = schnappschuss();

    // Runde 2: nochmal, ohne irgendetwas zu aendern.
    buildSuggestions();
    const runde2 = schnappschuss();

    // b) Ein bestehender Donnerstags-Vorschlag wird per Hand exakt
    // ueberschrieben — das bricht seinen harten Filter garantiert (die
    // Luecke, die ihn trug, ist jetzt belegt), statt auf Zufall zu hoffen.
    const doTag = weekDays()[3];   // Donnerstag
    const opfer = runde2.find(b => b.date === doTag.key);
    if (opfer) {
      state.blocks.push({ id: "konflikttermin", title: "Zahnarzt", areaId: "a1", day: 3,
        date: doTag.key, repeat: "none", start: opfer.start, end: opfer.end, frog: false });
    }
    save(); renderAll();
    buildSuggestions();
    const runde3 = schnappschuss();

    return { runde1, runde2, runde3, doTagKey: doTag.key, opferId: opfer ? opfer.id : null };
  });

  console.log('=== a) Zweimal verteilen ohne Aenderung ===');
  console.log('Bloecke Runde 1:', ab.runde1.length, ' Runde 2:', ab.runde2.length);
  const diffA = vergleiche(ab.runde1, ab.runde2);
  ok(diffA.bewegt.length === 0, 'a) kein Block bewegt sich zwischen Runde 1 und 2 (bewegt: ' +
    diffA.bewegt.length + ')');
  ok(diffA.verschwunden.length === 0, 'a) kein Block verschwindet (' + diffA.verschwunden.length + ')');
  ok(diffA.neu.length === 0, 'a) kein neuer Block entsteht (' + diffA.neu.length + ')');

  console.log('\n=== b) Neuer Termin am Donnerstag ===');
  ok(!!ab.opferId, 'b) Voraussetzung: es gab ueberhaupt einen Donnerstags-Vorschlag zum Ueberschreiben');
  const diffB = vergleiche(ab.runde2, ab.runde3);
  const andereTage = diffB.bewegt.concat(diffB.verschwunden, diffB.neu)
    .filter(id => {
      const vor = ab.runde2.find(b => b.id === id), nach = ab.runde3.find(b => b.id === id);
      const datum = (vor || nach).date;
      return datum !== ab.doTagKey;
    });
  console.log('Geaenderte IDs insgesamt:', JSON.stringify(diffB));
  ok(andereTage.length === 0, 'b) nur Donnerstag aendert sich, andere Tage bleiben identisch (Verstoesse: ' +
    andereTage.join(', ') + ')');
  const donnerstagGeaendert = diffB.bewegt.concat(diffB.verschwunden, diffB.neu)
    .some(id => {
      const vor = ab.runde2.find(b => b.id === id), nach = ab.runde3.find(b => b.id === id);
      return (vor || nach).date === ab.doTagKey;
    });
  ok(donnerstagGeaendert, 'b) Donnerstag aendert sich tatsaechlich (der ueberschriebene Vorschlag wird verworfen/neu gesetzt)');

  // -------------------------------------------------------------
  // c) Der laufende Tag wird nie automatisch umgeplant — selbst wenn
  //    sein harter Filter (hier: freigehaltener Tag) danach bricht.
  // -------------------------------------------------------------
  const c = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = new Date();   // aktuelle Woche, "heute" ist Teil davon
    state.blocks = [];
    const heuteKey = iso(new Date());
    const heuteDay = weekDays().find(d => d.key === heuteKey);
    state.blocks.push({ id: "heutesug", title: "Sport", areaId: "a3", day: heuteDay.i,
      date: heuteKey, repeat: "none", start: 9 * 60, end: 10 * 60, frog: false, sug: true });
    // Der harte Filter bricht absichtlich: der Tag wird freigehalten.
    dayMeta(heuteKey).frei = true;
    save(); renderAll();

    const vorher = state.blocks.find(b => b.id === "heutesug");
    const vorGueltig = vorschlagGueltig(vorher);
    const vorPos = { date: vorher.date, start: vorher.start };

    buildSuggestions();

    const nachher = state.blocks.find(b => b.id === "heutesug");
    return { vorGueltig, vorPos, existiertNachher: !!nachher,
             nachPos: nachher ? { date: nachher.date, start: nachher.start } : null };
  });
  console.log('\n=== c) Laufender Tag wird nicht angetastet ===');
  console.log(JSON.stringify(c, null, 1));
  ok(!c.vorGueltig, 'c) Voraussetzung: der harte Filter ist wirklich gebrochen (freigehaltener Tag)');
  ok(c.existiertNachher, 'c) der Vorschlag von heute existiert nach dem Verteilen noch');
  ok(c.existiertNachher && c.nachPos.date === c.vorPos.date && c.nachPos.start === c.vorPos.start,
    'c) der Vorschlag von heute bleibt exakt an Ort und Stelle (' +
    JSON.stringify(c.vorPos) + ' -> ' + JSON.stringify(c.nachPos) + ')');

  // -------------------------------------------------------------
  // d) block.fix bleibt liegen — auch mit gebrochenem Filter, auch nach
  //    zweimal Verteilen.
  // -------------------------------------------------------------
  const d = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);   // Zukunft, damit "heute" hier nicht mitspielt
    state.blocks = [];
    const tag = weekDays()[1];   // Dienstag
    state.blocks.push({ id: "fixiert", title: "Sport", areaId: "a3", day: tag.i,
      date: tag.key, repeat: "none", start: 9 * 60, end: 10 * 60, frog: false, sug: true, fix: true });
    dayMeta(tag.key).frei = true;   // harter Filter absichtlich gebrochen
    save(); renderAll();

    const vor = { date: state.blocks.find(b => b.id === "fixiert").date,
                  start: state.blocks.find(b => b.id === "fixiert").start };

    buildSuggestions();
    const n1 = state.blocks.find(b => b.id === "fixiert");
    const pos1 = n1 ? { date: n1.date, start: n1.start } : null;

    buildSuggestions();
    const n2 = state.blocks.find(b => b.id === "fixiert");
    const pos2 = n2 ? { date: n2.date, start: n2.start } : null;

    return { vor, existiert1: !!n1, pos1, existiert2: !!n2, pos2 };
  });
  console.log('\n=== d) block.fix bleibt liegen ===');
  console.log(JSON.stringify(d, null, 1));
  ok(d.existiert1 && d.pos1.date === d.vor.date && d.pos1.start === d.vor.start,
    'd) fixierter Block unveraendert nach der ersten Verteilung');
  ok(d.existiert2 && d.pos2.date === d.vor.date && d.pos2.start === d.vor.start,
    'd) fixierter Block unveraendert auch nach der zweiten Verteilung');

  // -------------------------------------------------------------
  // e) growSuggestions() kennt jetzt "jetzt" — der NORMALE Verteiler
  //    (buildSuggestions(), nicht der Rest-des-Tages-Weg) darf einen
  //    eigenen, bereits vergangenen Vorschlag von heute nicht mehr
  //    verlaengern. Braucht eine feste, zonierte Uhr (anders als a)-d)
  //    oben, wo "heute" bewusst keine Rolle spielt) — eigener Kontext,
  //    eigene Seite, derselbe Vertrag wie restdestag.js.
  //
  //    e.1) und e.2) sind bis auf das Datum IDENTISCH aufgebaut: derselbe
  //    Bereich, derselbe Block (9:00-9:45), dasselbe plan.from/plan.to-
  //    Fenster (9:45-10:00, macht die Luecke fuer einen ganz NEUEN Block
  //    leer und zwingt die restlichen 30 Minuten so in growSuggestions()
  //    hinein — genau der Pfad, der den Fehler zeigt). Der einzige
  //    Unterschied ist die Gegenprobe: e.1) heute (muss stehen bleiben),
  //    e.2) ein kuenftiger Tag dieser Woche (muss weiter wachsen wie
  //    bisher — sonst haette der Fix nur das Wachsen an sich abgeschaltet).
  // -------------------------------------------------------------
  const ctx2 = await br.newContext({ viewport: { width: 1400, height: 950 }, timezoneId: 'Europe/Berlin' });
  const p2 = await ctx2.newPage();
  const konsolenfehler2 = [];
  p2.on('pageerror', e => konsolenfehler2.push('PAGEERROR: ' + e.message));
  p2.on('console', m => { if (m.type() === 'error') konsolenfehler2.push('CONSOLE: ' + m.text()); });
  // Mittwoch, 14:00 — mitten am Tag, weit nach dem 10-Uhr-Fenster unten.
  await p2.clock.setFixedTime(new Date('2026-08-05T14:00:00+02:00'));
  await p2.goto(F);
  await p2.waitForTimeout(500);
  await p2.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p2.waitForTimeout(250);

  async function vergangenSetup(zukunft) {
    return p2.evaluate((zukunft) => {
      state = freshState(); migrate(state);
      state.settings.dayStart = 7; state.settings.dayEnd = 22;
      state.settings.sleep = { on: false };
      anchor = new Date();
      const heuteKey = iso(new Date());
      const tag = zukunft ? weekDays().find(d => d.key > heuteKey) : weekDays().find(d => d.key === heuteKey);

      const sport = state.areas.find(x => x.id === 'a3');
      sport.plan.goal = 1.25; sport.plan.must = false; sport.plan.days = [tag.i];
      // Fenster genau 15 Minuten ueber das Blockende hinaus — mit dem Block
      // selbst als "busy" bleibt daraus keine Luecke fuer einen neuen Block
      // (freeGaps() prueft das unten separat), die uebrigen 30 Minuten
      // muessen also durch growSuggestions() ans bestehende Ende wachsen.
      sport.plan.from = 9 * 60; sport.plan.to = 10 * 60;

      const id = 'sug_' + (zukunft ? 'zukunft' : 'heute');
      state.blocks = [{ id, title: 'Sport', areaId: 'a3', day: tag.i,
        date: tag.key, repeat: 'none', start: 9 * 60, end: 9 * 60 + 45, frog: false, sug: true }];
      save(); renderAll();

      const vorher = { start: state.blocks[0].start, end: state.blocks[0].end, sug: state.blocks[0].sug };
      const r = buildSuggestions();
      const nachher = state.blocks.find(b => b.id === id);
      return { tagKey: tag.key, vorher, r,
        nachher: nachher ? { start: nachher.start, end: nachher.end, sug: nachher.sug } : null };
    }, zukunft);
  }

  console.log('\n=== e.1) NORMALER Verteiler: eigener vergangener Vorschlag von HEUTE bleibt unangetastet ===');
  const e1 = await vergangenSetup(false);
  console.log(JSON.stringify(e1, null, 1));
  ok(!!e1.nachher, 'e.1) der Vorschlag existiert nach buildSuggestions() noch');
  ok(e1.nachher && e1.nachher.start === e1.vorher.start && e1.nachher.end === e1.vorher.end
    && e1.nachher.sug === e1.vorher.sug,
    'e.1) ...und bleibt Feld fuer Feld unveraendert (' + JSON.stringify(e1.vorher) + ' -> ' + JSON.stringify(e1.nachher) + ')');

  console.log('\n=== e.2) Gegenprobe: derselbe Aufbau an einem KUENFTIGEN Tag waechst weiter wie bisher ===');
  const e2 = await vergangenSetup(true);
  console.log(JSON.stringify(e2, null, 1));
  ok(!!e2.nachher, 'e.2) der Vorschlag existiert nach buildSuggestions() noch');
  ok(e2.nachher && e2.nachher.start === e2.vorher.start,
    'e.2) ...der Start bleibt gleich');
  ok(e2.nachher && e2.nachher.end > e2.vorher.end,
    'e.2) ...aber das Ende waechst weiterhin, wie es das vor diesem Auftrag auch tat (' +
    e2.vorher.end + ' -> ' + (e2.nachher && e2.nachher.end) + ')');

  console.log('\n=== e.3) Kalter Erstlauf ohne vorhandene Vorschlaege bleibt unveraendert ===');
  const e3 = await p2.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: true, from: 22 * 60 + 30, to: 6 * 60 + 30, wind: 30 };
    const set = (id, h, must, pad) => { const a = state.areas.find(x => x.id === id);
      a.plan.goal = h; a.plan.must = must; if (pad !== undefined) a.plan.pad = pad; };
    set("a1", 20, true, 60); set("a2", 12, true); set("a3", 4, true); set("a6", 4, true); set("a5", 8, false);
    anchor = new Date();   // die aktuelle (fixierte) Woche, "heute" ist Teil davon — anders als realtest.js
    state.blocks = [];
    save(); renderAll();
    const r = buildSuggestions();
    const schnappschuss = state.blocks.filter(b => b.sug && !b.grob)
      .map(b => ({ areaId: b.areaId, date: b.date, start: b.start, end: b.end }))
      .sort((a, b) => a.date === b.date ? a.start - b.start : (a.date < b.date ? -1 : 1));
    return { r, anzahl: schnappschuss.length, schnappschuss };
  });
  console.log(JSON.stringify({ r: e3.r, anzahl: e3.anzahl }, null, 1));
  // Festgenagelt am 2026-08-08 (siehe oben) vor der Aenderung an
  // growSuggestions() gemessen — muss nach der Aenderung Zahl fuer Zahl
  // gleich bleiben, weil ohne vorhandene Vorschlaege nichts da ist, das
  // die neue Regel ueberhaupt uebergehen koennte.
  const e3Erwartet = { r: { placed: 2880, missing: 0, areas: 5, hinweise: [] },
    anzahl: 34 };
  ok(JSON.stringify({ r: e3.r, anzahl: e3.anzahl }) === JSON.stringify(e3Erwartet),
    'e.3) kalter Erstlauf liefert dieselben Kennzahlen wie vor der Aenderung (' +
    JSON.stringify({ r: e3.r, anzahl: e3.anzahl }) + ' vs. erwartet ' + JSON.stringify(e3Erwartet) + ')');

  console.log('\nKonsolenfehler (e):', konsolenfehler2.length ? konsolenfehler2 : 'keine');
  await ctx2.close();

  console.log('\nKonsolenfehler:', konsolenfehler.length ? konsolenfehler : 'keine');
  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  await br.close();
  if (fehler.length || konsolenfehler.length || konsolenfehler2.length) process.exit(1);
})();
