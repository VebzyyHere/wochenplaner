/* ============================================================
   Pruefskript Restdestag (Stufe 15) — "Tag durcheinander?" in "Heute".

   a) Der Knopf erscheint nur unter allen zugleich erfuellten Bedingungen —
      heutiger Tag ausgewaehlt, der Tag hat schon etwas stehen (sonst
      deckt die vorhandene "Vorschlagen"-Flaeche im leeren Zweig das ab),
      es gibt ueberhaupt noch etwas zu verteilen, und die Feierabendzeit
      ist noch nicht erreicht (danach uebernimmt der Tagesabschluss) — und
      NICHT sonst: ein anderer Tag angewaehlt, ein leerer Tag, nirgends
      mehr offene Zielminuten, oder schon Feierabend.
   b) Antippen erzeugt Vorschlaege nur ab der festgenagelten Uhrzeit,
      nichts davor — sowohl fuer den exakten als auch den groben Weg.
   c) Ein fester Termin UND eine Serie liegen nach dem Antippen
      unveraendert dort, wo sie vorher lagen.
   d) Jeder erzeugte Vorschlag traegt eine nicht-leere Begruendungszeile.
   e) Die vorhandene Vorschlagsleiste uebernimmt bzw. verwirft diese
      Vorschlaege wie jeden anderen — keine zweite Vorschlagsmechanik.
   f) undoLast() fuehrt nach dem Antippen sauber zum Stand davor zurueck.
   g) OHNE Antippen passiert nichts — auch der Sichtbarkeits-Check des
      Knopfs selbst veraendert state.blocks nicht. Das ist die wichtigste
      Zusicherung dieses Skripts.
   h) Ein freigehaltener Tag (state.days[key].frei) haelt den Knopf
      unsichtbar UND laesst einen direkten Aufruf von restDesTagesBauen()
      leerlaufen — derselbe Vertrag wie ueberall sonst im Verteiler
      (istFrei()).
   i) Ein eigener sug-Block von heute, dessen Zeit schon vorbei ist, bleibt
      Feld fuer Feld unveraendert (start, end, sug) — sowohl am normalen als
      auch am freigehaltenen Tag. growSuggestions() (aufgerufen aus
      placeArea()) kennt "jetzt" nicht und wuerde ihn sonst beim Auffuellen
      des Feierabend-Rests verlaengern.
   j) Ein dritter Terminfall zusaetzlich zu einmalig (c) und woechentlich
      (c): ein zweiwoechentlicher Termin (repeat "2wochen" mit since) bleibt
      nach dem Antippen ebenso unangetastet.

   Stil wie schleife.js/stabil.js: eine Chromium-Seite, deutsche Ausgabe,
   Exit 1 bei Fehlern. Uhrzeit, Datum UND Zeitzone werden ueber
   page.clock.setFixedTime() und timezoneId festgenagelt (Playwright 1.62),
   NICHT ueber die echte Systemuhr — sonst haengt jedes Ergebnis hier davon
   ab, wann das Skript zufaellig laeuft. Die Zone gehoert dazu, weil das
   ISO-Literal sonst als lokale Zeit des ausfuehrenden Rechners gelesen
   wuerde.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ viewport: { width: 1400, height: 950 }, timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  // Feste Uhrzeit: Mittwoch, 14:00 — mitten am Tag, weit vor Feierabend
  // (dayEnd 22 Uhr) und weit nach Tagesbeginn (dayStart 7 Uhr). Ab hier
  // steht new Date() im Browser immer hier, bis zum Abschnitt a5).
  await p.clock.setFixedTime(new Date('2026-08-05T14:00:00+02:00'));
  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  // Grundszenario: heute stehen schon ein fester Termin und eine Serie
  // (roter-Linien-Testobjekte fuer c), zwei Bereiche haben noch offene
  // Zielminuten fuer diese Woche — Sport (a3) exakt, Hobby (a4) grob, per
  // ART_STANDARD ohnehin plan.grob === true. Genug Luft zwischen 14:00 und
  // dem Feierabend (22:00) fuer beide, auch nach Abzug der zwei Fixtermine.
  async function basisSetup() {
    return p.evaluate(() => {
      state = freshState(); migrate(state);
      state.settings.dayStart = 7; state.settings.dayEnd = 22;
      state.settings.sleep = { on: false };
      anchor = new Date();
      selectedDayIdx = (new Date().getDay() + 6) % 7;
      const heuteI = selectedDayIdx, heuteKey = iso(anchor);

      const sport = state.areas.find(x => x.id === 'a3');
      sport.plan.goal = 4; sport.plan.must = false;          // 240 offene Minuten, exakt
      const hobby = state.areas.find(x => x.id === 'a4');
      hobby.plan.goal = 2; hobby.plan.grob = true;           // 120 offene Minuten, grob

      state.blocks = [
        // Fester Termin, nach jetzt (14:00) — Testobjekt fuer c).
        { id: uid(), title: 'Zahnarzt', areaId: 'a1', day: heuteI, date: heuteKey,
          repeat: 'none', start: 17 * 60, end: 18 * 60, frog: false },
        // Woechentliche Serie, ebenfalls heute — zweites Testobjekt fuer c).
        { id: uid(), title: 'Yoga', areaId: 'a6', day: heuteI, date: heuteKey,
          repeat: 'weekly', start: 19 * 60, end: 19 * 60 + 45, frog: false }
      ];
      save(); setView('heute'); renderAll();
      return { heuteI, heuteKey, jetzt: new Date().getHours() * 60 + new Date().getMinutes(),
        vorher: JSON.parse(JSON.stringify(state.blocks)) };
    });
  }

  // ==============================================================
  // g) OHNE Antippen passiert nichts — die wichtigste Zusicherung.
  // ==============================================================
  console.log('=== g) ohne Antippen passiert nichts ===');
  const g1 = await basisSetup();
  await p.waitForTimeout(700);   // aufs Nichts warten, nicht auf ein Ergebnis
  const g2 = await p.evaluate(() => ({
    anzahl: state.blocks.length,
    sug: state.blocks.filter(b => b.sug).length
  }));
  console.log('Vorher/Nachher ohne Klick:', JSON.stringify({ vorher: g1.vorher.length, g2 }));
  ok(g2.anzahl === g1.vorher.length, 'g) kein Block ist von selbst entstanden (' + g1.vorher.length + ' -> ' + g2.anzahl + ')');
  ok(g2.sug === 0, 'g) kein Vorschlag ist von selbst entstanden (' + g2.sug + ')');

  const g3 = await p.evaluate(() => {
    const vorher = JSON.stringify(state.blocks);
    restDesTagesMoeglich(); restDesTagesMoeglich(); restDesTagesMoeglich();
    return vorher === JSON.stringify(state.blocks);
  });
  ok(g3, 'g) restDesTagesMoeglich() (der Sichtbarkeits-Check hinter dem Knopf) veraendert state.blocks nicht');

  // ==============================================================
  // a) Sichtbarkeit — der Normalfall zuerst.
  // ==============================================================
  console.log('\n=== a) Sichtbarkeit des Knopfs ===');
  const a1 = await p.evaluate(() => !!document.getElementById('restTagBtn'));
  ok(a1, 'a) normaler Fall: heute, schon etwas geplant, noch Platz, vor Feierabend -> Knopf da');

  // a) Gegenfall 1: ein anderer Tag ist ausgewaehlt.
  const a2 = await p.evaluate(() => {
    selectedDayIdx = (selectedDayIdx + 1) % 7;
    renderGrid(); renderDaySwitch(); renderAgenda(); renderEnergy();
    return !!document.getElementById('restTagBtn');
  });
  ok(!a2, 'a) auf einen anderen Tag geblaettert -> Knopf weg');
  await p.evaluate(() => {
    // zurueck auf heute, fuer die naechsten Gegenfaelle
    selectedDayIdx = (new Date().getDay() + 6) % 7;
    renderGrid(); renderDaySwitch(); renderAgenda(); renderEnergy();
  });

  // a) Gegenfall 2: heute ist komplett leer.
  const a3 = await p.evaluate(() => {
    state.blocks = [];
    save(); renderAll();
    return {
      restBtn: !!document.getElementById('restTagBtn'),
      vorschlagBtn: !!document.getElementById('agendaVorschlag')
    };
  });
  ok(!a3.restBtn, 'a) leerer Tag -> "Tag durcheinander?" bleibt weg');
  ok(a3.vorschlagBtn, 'a) leerer Tag -> die vorhandene "Vorschlagen"-Flaeche steht stattdessen (kein zweiter Mechanismus fuer denselben Fall)');

  // a) Gegenfall 3: etwas ist geplant, aber nirgends offene Zielminuten.
  const a4 = await basisSetup().then(() => p.evaluate(() => {
    state.areas.find(x => x.id === 'a3').plan.goal = 0;
    state.areas.find(x => x.id === 'a4').plan.goal = 0;
    save(); renderAll();
    return !!document.getElementById('restTagBtn');
  }));
  ok(!a4, 'a) nichts mehr zu verteilen -> Knopf weg (waere sonst Laerm)');

  // a) Gegenfall 4: schon Feierabend.
  const a5 = await basisSetup().then(() => p.evaluate(() => {
    state.settings.dayEnd = 14;   // 14:00 = jetzt -> Feierabend bereits erreicht
    save(); renderAll();
    return {
      restBtn: !!document.getElementById('restTagBtn'),
      abschluss: !!document.querySelector('.abschlussliste')
    };
  }));
  ok(!a5.restBtn, 'a) nach der Feierabendzeit -> "Tag durcheinander?" bleibt weg');
  ok(a5.abschluss, 'a) ...der Tagesabschluss steht an genau der Stelle statt (kein doppeltes Angebot)');

  // ==============================================================
  // b) + c) + d): Antippen selbst.
  // ==============================================================
  console.log('\n=== b)+c)+d) Antippen ===');
  const bcd0 = await basisSetup();
  const vorFix = bcd0.vorher.map(b => ({ id: b.id, title: b.title, date: b.date, day: b.day,
    start: b.start, end: b.end, areaId: b.areaId, repeat: b.repeat }));

  await p.click('#restTagBtn');
  await p.waitForTimeout(200);

  const nach = await p.evaluate(() => ({
    jetzt: new Date().getHours() * 60 + new Date().getMinutes(),
    neu: state.blocks.filter(b => b.sug === true).map(b => ({
      id: b.id, areaId: b.areaId, date: b.date, grob: !!b.grob,
      start: b.start, end: b.end, teil: b.teil, grund: b.grund
    }))
  }));
  const fixNachher = await p.evaluate((ids) => ids.map(id => {
    const b = state.blocks.find(x => x.id === id);
    return b && { id: b.id, title: b.title, date: b.date, day: b.day, start: b.start, end: b.end,
      areaId: b.areaId, repeat: b.repeat };
  }), vorFix.map(b => b.id));

  console.log('Neue Vorschlaege:', JSON.stringify(nach.neu, null, 1));
  ok(nach.neu.length > 0, 'b/d) das Antippen hat ueberhaupt Vorschlaege erzeugt (' + nach.neu.length + ')');
  ok(nach.neu.every(b => b.date === bcd0.heuteKey), 'b) jeder neue Vorschlag liegt auf dem heutigen Datum');

  const exakte = nach.neu.filter(b => !b.grob);
  const grobe = nach.neu.filter(b => b.grob);
  ok(exakte.length > 0, 'b) es gibt exakte Vorschlaege (Sport) zum Pruefen (' + exakte.length + ')');
  ok(grobe.length > 0, 'b) es gibt grobe Vorschlaege (Hobby) zum Pruefen (' + grobe.length + ')');
  const nowCursor = Math.ceil((bcd0.jetzt + 10) / 15) * 15;
  ok(exakte.every(b => b.start >= nowCursor),
    'b) kein exakter Vorschlag beginnt vor jetzt (Grenze ' + nowCursor + ' min, Startzeiten ' + JSON.stringify(exakte.map(b => b.start)) + ')');
  ok(grobe.every(b => b.teil !== 'vm'),
    'b) kein grober Vorschlag liegt im laengst vorbeigezogenen Abschnitt "vm" (Abschnitte: ' + JSON.stringify(grobe.map(b => b.teil)) + ')');

  ok(nach.neu.every(b => typeof b.grund === 'string' && b.grund.length > 0),
    'd) jeder erzeugte Vorschlag hat eine nicht-leere Begruendungszeile (' + JSON.stringify(nach.neu.map(b => b.grund)) + ')');

  ok(JSON.stringify(fixNachher) === JSON.stringify(vorFix),
    'c) der feste Termin und die Serie liegen unveraendert dort, wo sie vorher lagen (' +
    JSON.stringify({ vorher: vorFix, nachher: fixNachher }) + ')');

  // ==============================================================
  // f) Rueckgaengig.
  // ==============================================================
  console.log('\n=== f) undoLast() ===');
  await p.evaluate(() => undoLast());
  await p.waitForTimeout(200);
  const f1 = await p.evaluate((idsVorher) => {
    const jetzt = state.blocks.map(b => b.id).sort();
    return { anzahl: state.blocks.length, sug: state.blocks.filter(b => b.sug).length, ids: jetzt };
  }, vorFix.map(b => b.id));
  console.log('Nach undoLast():', JSON.stringify({ anzahl: f1.anzahl, sug: f1.sug }));
  ok(f1.anzahl === bcd0.vorher.length, 'f) undoLast() bringt die Blockzahl auf den Stand vor dem Antippen zurueck (' +
    bcd0.vorher.length + ' -> ' + f1.anzahl + ')');
  ok(f1.sug === 0, 'f) undoLast() nimmt auch die eben erzeugten Vorschlaege wieder zurueck (' + f1.sug + ' verbleiben)');
  ok(JSON.stringify(f1.ids) === JSON.stringify(bcd0.vorher.map(b => b.id).sort()),
    'f) es sind wieder genau dieselben Bloecke wie vor dem Antippen da');

  // ==============================================================
  // e) Vorschlagsleiste — Uebernehmen.
  // ==============================================================
  console.log('\n=== e) Vorschlagsleiste: Uebernehmen ===');
  await basisSetup();
  await p.click('#restTagBtn');
  await p.waitForTimeout(200);
  const e1 = await p.evaluate(() => ({
    sugbarAktiv: document.body.dataset.sugbar === '1',
    sugVorher: state.blocks.filter(b => b.sug).length,
    hatAccept: !!document.querySelector('#sugBar .sugbar__accept')
  }));
  ok(e1.sugbarAktiv, 'e) die Vorschlagsleiste ist aktiv, nachdem der Knopf Vorschlaege erzeugt hat');
  ok(e1.sugVorher > 0 && e1.hatAccept, 'e) Voraussetzung: es gibt Vorschlaege und einen "Uebernehmen"-Knopf');

  await p.evaluate(() => document.querySelector('#sugBar .sugbar__accept').click());
  await p.waitForTimeout(200);
  const e2 = await p.evaluate(() => ({
    sugDanach: state.blocks.filter(b => b.sug).length,
    sugbarAktiv: document.body.dataset.sugbar === '1'
  }));
  ok(e2.sugDanach === 0, 'e) "Uebernehmen" macht aus den Vorschlaegen dieses Knopfs normale Eintraege (' + e2.sugDanach + ' verbleiben)');
  ok(!e2.sugbarAktiv, 'e) die Vorschlagsleiste verschwindet danach wieder');

  // ==============================================================
  // e) Vorschlagsleiste — Verwerfen.
  // ==============================================================
  console.log('\n=== e) Vorschlagsleiste: Verwerfen ===');
  const e3 = await basisSetup();
  await p.click('#restTagBtn');
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('#sugBar .sugbar__close').click());
  await p.waitForTimeout(200);
  const e4 = await p.evaluate((idsFix) => ({
    sugDanach: state.blocks.filter(b => b.sug).length,
    fixNochDa: idsFix.every(id => !!state.blocks.find(x => x.id === id))
  }), e3.vorher.map(b => b.id));
  ok(e4.sugDanach === 0, 'e) "×" verwirft die Vorschlaege dieses Knopfs wieder vollstaendig (' + e4.sugDanach + ' verbleiben)');
  ok(e4.fixNochDa, 'e) der feste Termin und die Serie bleiben beim Verwerfen unberuehrt stehen');

  // ==============================================================
  // h) + i) teilen sich ein Setup: Sport-Ziel offen, ein fester Termin
  // (damit der Tag nicht leer ist) und ein eigener Vorschlag von heute
  // Mittag, der um 14 Uhr schon 45 Minuten vorbei ist — die Reproduktion
  // aus dem Auftrag. Ein Setup nur mit festen Terminen (wie basisSetup)
  // reicht fuer h) NICHT: growSuggestions() kennt istFrei() gar nicht und
  // wird nur beim Wachsenlassen eines VORHANDENEN sug-Blocks sichtbar —
  // ohne einen solchen Block bliebe placed=0 auch am freigehaltenen Tag
  // in der unreparierten Fassung, und h) wuerde die Verletzung gar nicht
  // sehen.
  // ==============================================================
  async function vergSetup(frei) {
    return p.evaluate((frei) => {
      state = freshState(); migrate(state);
      state.settings.dayStart = 7; state.settings.dayEnd = 22;
      state.settings.sleep = { on: false };
      anchor = new Date();
      selectedDayIdx = (new Date().getDay() + 6) % 7;
      const heuteI = selectedDayIdx, heuteKey = iso(anchor);

      const sport = state.areas.find(x => x.id === 'a3');
      sport.plan.goal = 6; sport.plan.must = false;

      if (frei) state.days[heuteKey] = { frei: true };

      const sugId = uid();
      state.blocks = [
        // Echter Termin, damit der Tag nicht leer ist.
        { id: uid(), title: 'Zahnarzt', areaId: 'a1', day: heuteI, date: heuteKey,
          repeat: 'none', start: 960, end: 1020, frog: false },
        // 13:00-13:15 — bei fester Uhr 14:00 vollstaendig vorbei.
        { id: sugId, title: 'Sport', areaId: 'a3', day: heuteI, date: heuteKey,
          repeat: 'none', start: 780, end: 795, sug: true, frog: false }
      ];
      save(); setView('heute'); renderAll();
      // Dieselbe reduzierte Form wie beim Nachher-Lesen weiter unten (id,
      // start, end, sug) — sonst vergleicht JSON.stringify() zwei
      // unterschiedlich grosse Objekte und meldet auch bei gleichen Werten
      // einen Unterschied.
      const b = state.blocks.find(x => x.id === sugId);
      return { heuteKey, sugId,
        sugVorher: { id: b.id, start: b.start, end: b.end, sug: b.sug } };
    }, frei);
  }

  console.log('\n=== h) freigehaltener Tag ===');
  const h0 = await vergSetup(true);
  const h1 = await p.evaluate(() => ({ restBtn: !!document.getElementById('restTagBtn') }));
  ok(!h1.restBtn, 'h) Tag freigehalten -> "Tag durcheinander?" erscheint nicht mehr');

  const h2 = await p.evaluate((id) => {
    const vorherAnzahl = state.blocks.length;
    const r = restDesTagesBauen();
    const b = state.blocks.find(x => x.id === id);
    return { r, vorherAnzahl, anzahl: state.blocks.length,
      block: b && { id: b.id, start: b.start, end: b.end, sug: b.sug } };
  }, h0.sugId);
  console.log('Direkter Aufruf auf freigehaltenem Tag:', JSON.stringify(h2));
  ok(h2.r.placed === 0, 'h) direkter Aufruf von restDesTagesBauen() liefert placed:0 (' + h2.r.placed + ')');
  ok(h2.anzahl === h2.vorherAnzahl, 'h) ...legt keinen neuen Block an (' + h2.vorherAnzahl + ' -> ' + h2.anzahl + ')');
  ok(JSON.stringify(h2.block) === JSON.stringify(h0.sugVorher),
    'h) ...und veraendert auch den vorhandenen vergangenen Vorschlag nicht (' +
    JSON.stringify({ vorher: h0.sugVorher, nachher: h2.block }) + ')');

  // ==============================================================
  // i) Ein vergangener eigener sug-Block bleibt unangetastet.
  // ==============================================================
  console.log('\n=== i) vergangener eigener Vorschlag bleibt unangetastet ===');

  // normaler Tag — ueber den echten Knopf, wie im Auftrag beschrieben.
  const i1 = await vergSetup(false);
  const i1btn = await p.evaluate(() => !!document.getElementById('restTagBtn'));
  ok(i1btn, 'i) Voraussetzung normaler Tag: der Knopf steht (genau das ruft restDesTagesBauen() auf)');
  const i2 = await p.evaluate((id) => {
    // Minuten von Sport heute VOR dem Aufruf — Grundlage fuer die
    // Gegenrechnung unten. Der vergangene Block zaehlt mit, aendert sich
    // aber laut obigem Vertrag netto auf null.
    const vorherMin = state.blocks.filter(b => b.areaId === 'a3' && b.date === iso(new Date()))
      .reduce((s, b) => s + dauerVon(b), 0);
    const r = restDesTagesBauen();
    const nachherMin = state.blocks.filter(b => b.areaId === 'a3' && b.date === iso(new Date()))
      .reduce((s, b) => s + dauerVon(b), 0);
    const b = state.blocks.find(x => x.id === id);
    return { r, vorherMin, nachherMin, block: b && { id: b.id, start: b.start, end: b.end, sug: b.sug } };
  }, i1.sugId);
  console.log('Normaler Tag, vorher/nachher:', JSON.stringify({ vorher: i1.sugVorher, nachher: i2.block }));
  ok(JSON.stringify(i2.block) === JSON.stringify(i1.sugVorher),
    'i) normaler Tag: der vergangene eigene Vorschlag bleibt nach dem Aufruf Feld fuer Feld unveraendert');
  console.log('Gegenrechnung (r.placed gegen tatsaechlich neu verplante Minuten):', JSON.stringify(i2.r), i2.vorherMin, '->', i2.nachherMin);
  ok(i2.r.placed === i2.nachherMin - i2.vorherMin,
    'i) r.placed zaehlt genau die tatsaechlich neu verplanten Minuten (' + i2.r.placed + ' vs. ' + (i2.nachherMin - i2.vorherMin) +
    ') — die am vergangenen Block zurückgenommene Verlaengerung meldet sich nicht faelschlich als Erfolg');

  // freigehaltener Tag — kein Knopf, darum direkter Aufruf wie in h).
  const i3 = await vergSetup(true);
  await p.evaluate(() => restDesTagesBauen());
  const i4 = await p.evaluate((id) => {
    const b = state.blocks.find(x => x.id === id);
    return b && { id: b.id, start: b.start, end: b.end, sug: b.sug };
  }, i3.sugId);
  console.log('Freigehaltener Tag, vorher/nachher:', JSON.stringify({ vorher: i3.sugVorher, nachher: i4 }));
  ok(JSON.stringify(i4) === JSON.stringify(i3.sugVorher),
    'i) freigehaltener Tag: derselbe vergangene Vorschlag bleibt ebenfalls unveraendert');

  // ==============================================================
  // j) Dritter Terminfall: ein zweiwoechentlicher Termin (repeat "2wochen"
  // mit since) — zusaetzlich zu einmalig und woechentlich aus c).
  // ==============================================================
  console.log('\n=== j) zweiwoechentlicher Termin bleibt unangetastet ===');
  async function serienSetup() {
    return p.evaluate(() => {
      state = freshState(); migrate(state);
      state.settings.dayStart = 7; state.settings.dayEnd = 22;
      state.settings.sleep = { on: false };
      anchor = new Date();
      selectedDayIdx = (new Date().getDay() + 6) % 7;
      const heuteI = selectedDayIdx, heuteKey = iso(anchor);

      const sport = state.areas.find(x => x.id === 'a3');
      sport.plan.goal = 4; sport.plan.must = false;

      state.blocks = [
        { id: uid(), title: 'Zahnarzt', areaId: 'a1', day: heuteI, date: heuteKey,
          repeat: 'none', start: 17 * 60, end: 18 * 60, frog: false },
        { id: uid(), title: 'Yoga', areaId: 'a6', day: heuteI, date: heuteKey,
          repeat: 'weekly', start: 19 * 60, end: 19 * 60 + 45, frog: false },
        // Zweiwoechentlich, since auf den Montag dieser Woche -> Paritaet 0,
        // der Termin gilt diese Woche. Vor jetzt (13:00-13:20), damit er dem
        // Verteiler keinen Platz nach 14 Uhr wegnimmt.
        { id: uid(), title: 'Physio', areaId: 'a1', day: heuteI, date: heuteKey,
          repeat: '2wochen', since: iso(mondayOf(anchor)), start: 13 * 60, end: 13 * 60 + 20, frog: false }
      ];
      save(); setView('heute'); renderAll();
      return { heuteKey, vorher: JSON.parse(JSON.stringify(state.blocks)) };
    });
  }
  const j0 = await serienSetup();
  await p.click('#restTagBtn');
  await p.waitForTimeout(200);
  const j1 = await p.evaluate((idsFix) => idsFix.map(id => {
    const b = state.blocks.find(x => x.id === id);
    return b && { id: b.id, title: b.title, date: b.date, day: b.day, start: b.start, end: b.end,
      areaId: b.areaId, repeat: b.repeat, since: b.since };
  }), j0.vorher.map(b => b.id));
  const j0Vergleich = j0.vorher.map(b => ({ id: b.id, title: b.title, date: b.date, day: b.day,
    start: b.start, end: b.end, areaId: b.areaId, repeat: b.repeat, since: b.since }));
  console.log('Feste Termine vorher/nachher:', JSON.stringify({ vorher: j0Vergleich, nachher: j1 }));
  ok(JSON.stringify(j1) === JSON.stringify(j0Vergleich),
    'j) einmaliger, woechentlicher UND zweiwoechentlicher Termin liegen nach dem Antippen unveraendert dort, wo sie vorher lagen');

  console.log('\nKonsolenfehler:', konsolenfehler.length ? konsolenfehler : 'keine');
  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  await br.close();
  if (fehler.length || konsolenfehler.length) process.exit(1);
})();
