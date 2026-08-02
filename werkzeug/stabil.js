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

  console.log('\nKonsolenfehler:', konsolenfehler.length ? konsolenfehler : 'keine');
  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  await br.close();
  if (fehler.length || konsolenfehler.length) process.exit(1);
})();
