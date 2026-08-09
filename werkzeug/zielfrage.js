/* ============================================================
   Pruefskript "Zielfrage" — die doppelte Wann-Frage im Ziele-Editor wird eine.

   Vor dieser Runde stand in der aufgeklappten Ziele-Karte zweimal fast
   dieselbe Frage: "Wann darf der Vorschlag das einplanen?" (plan.days/
   from/to) und, im eingebetteten regelnEditor(), "Nur an bestimmten
   Tagen/Uhrzeiten moeglich? (zusaetzlich zum Zeitraum oben)"
   (area.regeln.fenster) — beide UND-verknuepft vom Verteiler, aber nie als
   solche zu erkennen. Jetzt gibt es genau eine Gruppe "Wann darf das
   stattfinden?", die beim Oeffnen die vorher unsichtbare Schnittmenge zeigt
   und beim Speichern kanonisch ins Trio plan.days/from/to schreibt —
   area.regeln.fenster verschwindet dabei, der Anker bleibt.

     a) Struktur   — genau eine Mo-So-Chipreihe + ein Zeitpaar in der
                      aufgeklappten Karte, kein "zusaetzlich zum Zeitraum
                      oben" mehr.
     b) Saat        — plan.days=alle + Fenster Mo-Sa 8-20 zeigt beim Oeffnen
                      Mo-Sa/08:00/20:00.
     c) Idempotenz  — unveraendertes Speichern raeumt area.regeln.fenster,
                      traegt die Schnittmenge ins Trio, laesst den Anker
                      unangetastet und liefert dieselben Vorschlaege wie vor
                      dem Speichern.
     d) Wirkung     — "So" abwaehlen + Spaetestens 20:00 speichern: kein
                      Vorschlag am Sonntag, keiner nach 20:00 (das
                      dokumentierte Nutzerbeispiel a der Abnahme).
     e) Abbrechen   — stellt Trio UND ein vorhandenes Fenster unveraendert
                      zurueck.
     f) Gegenprobe  — taskSheet() zeigt weiterhin seinen eigenen
                      Fenster-Block (nur die Ziele-Seite wurde verschmolzen).

   Jede Zusicherung schluege am unveraenderten Stand nachweislich fehl: a)
   faende zwei Chipreihen bzw. die alte Klammer, b) saehe dort noch
   Standard-Werte (07:00 statt 08:00) statt der Schnittmenge, c) faende
   area.regeln.fenster nach dem Speichern weiterhin vor, d) waere "So" nach
   dem Speichern nicht wirklich raus, weil das alte Fenster (falls vorhanden)
   getrennt geblieben waere, e) gaebe es kein zweites Feld, das ueberhaupt
   zurueckgestellt werden muesste, f) faende in taskSheet() denselben
   verschmolzenen Editor ohne Fenster-Block.

   Uhrzeit/Datum/Zeitzone genagelt (page.clock.setFixedTime, Europe/Berlin),
   Stil wie regeln.js/abbrechen.js. Exit 1 bei Fehlern.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const p = await br.newPage({ viewport: { width: 1400, height: 950 }, timezoneId: 'Europe/Berlin' });
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  await p.clock.setFixedTime(new Date('2026-08-05T10:00:00+02:00'));
  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(200);

  // Frischer Zustand, feste Zukunftswoche (wie regeln.js) — buildSuggestions()
  // soll fuer die ganze Woche zaehlen, nicht durch "heute schon vorbei" verzerrt sein.
  await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    save(); renderAll();
  });

  const idxAlltag = await p.evaluate(() => state.areas.findIndex(a => a.id === 'a7'));

  const oeffnen = async () => {
    await p.evaluate(() => goalsSheet());
    await p.waitForTimeout(250);
    const row = p.locator('#gList .goalrow').nth(idxAlltag);
    await row.locator('.goalrow__more').click();
    await p.waitForTimeout(150);
    return row;
  };

  // -------------------------------------------------------------
  // a) Struktur: genau eine Mo-So-Chipreihe + ein Zeitpaar, keine alte Klammer.
  // -------------------------------------------------------------
  let reihe = await oeffnen();
  const struktur = await reihe.evaluate(r => {
    const chipreihen = [...r.querySelectorAll('.chipset')].filter(cs => {
      const texte = [...cs.querySelectorAll('button')].map(b => b.textContent.trim());
      return texte.length === 7 && texte.join(',') === 'Mo,Di,Mi,Do,Fr,Sa,So';
    });
    return {
      mosoAnzahl: chipreihen.length,
      zeitpaare: r.querySelectorAll("input[type='time']").length,
      klammer: r.textContent.includes('zusätzlich zum Zeitraum oben'),
      hatRTage: !!r.querySelector('.rTage')
    };
  });
  ok(struktur.mosoAnzahl === 1, 'a) genau eine Mo-So-Chipreihe (' + struktur.mosoAnzahl + ')');
  ok(struktur.zeitpaare === 2, 'a) genau ein Zeitpaar = zwei time-Felder (' + struktur.zeitpaare + ')');
  ok(!struktur.hatRTage, 'a) kein eigener Fenster-Block (.rTage) mehr in der Ziele-Karte');
  ok(!struktur.klammer, 'a) "zusätzlich zum Zeitraum oben" kommt nicht mehr vor');
  await p.click('.sheet__foot button:has-text("Abbrechen")');
  await p.waitForTimeout(150);

  // -------------------------------------------------------------
  // b) + c): Saat = Schnittmenge, unveraendertes Speichern raeumt das Fenster
  //    und aendert die effektive Planung nicht (Idempotenz).
  // -------------------------------------------------------------
  const vorher = await p.evaluate(() => {
    const alltag = state.areas.find(a => a.id === 'a7');
    alltag.plan.goal = 10; alltag.plan.must = true; alltag.plan.days = [0,1,2,3,4,5,6];
    alltag.plan.from = null; alltag.plan.to = null;
    alltag.regeln = { fenster: [{ tage: [0,1,2,3,4,5], von: 8*60, bis: 20*60 }], anker: null };
    save(); renderAll();
    clearSuggestions();
    buildSuggestions();
    return state.blocks.filter(b => b.sug && b.areaId === 'a7')
      .map(b => b.day + '@' + b.start).sort();
  });

  reihe = await oeffnen();
  const saat = await reihe.evaluate(r => ({
    tage: [...r.querySelector('.gDays').querySelectorAll('button')]
      .map(b => b.getAttribute('aria-pressed') === 'true'),
    von: r.querySelector('.gFrom').value,
    bis: r.querySelector('.gTo').value
  }));
  ok(JSON.stringify(saat.tage) === JSON.stringify([true,true,true,true,true,true,false]),
    'b) Saat zeigt Mo-Sa gedrueckt, So nicht (' + JSON.stringify(saat.tage) + ')');
  ok(saat.von === '08:00', 'b) Saat zeigt Fruehestens 08:00 (' + saat.von + ')');
  ok(saat.bis === '20:00', 'b) Saat zeigt Spaetestens 20:00 (' + saat.bis + ')');

  await p.click('.sheet__foot button:has-text("Speichern")');
  await p.waitForTimeout(150);

  const nachSpeichern = await p.evaluate(() => {
    const alltag = state.areas.find(a => a.id === 'a7');
    clearSuggestions();
    buildSuggestions();
    return {
      regeln: alltag.regeln,
      days: alltag.plan.days,
      from: alltag.plan.from,
      to: alltag.plan.to,
      vorschlaege: state.blocks.filter(b => b.sug && b.areaId === 'a7')
        .map(b => b.day + '@' + b.start).sort()
    };
  });
  ok(!nachSpeichern.regeln || !nachSpeichern.regeln.fenster,
    'c) area.regeln.fenster ist nach dem Speichern weg (' + JSON.stringify(nachSpeichern.regeln) + ')');
  ok(JSON.stringify(nachSpeichern.days) === JSON.stringify([0,1,2,3,4,5]),
    'c) plan.days traegt die Schnittmenge Mo-Sa (' + JSON.stringify(nachSpeichern.days) + ')');
  ok(nachSpeichern.from === 8*60 && nachSpeichern.to === 20*60,
    'c) plan.from/to tragen 08:00/20:00 (' + nachSpeichern.from + '/' + nachSpeichern.to + ')');
  ok(JSON.stringify(nachSpeichern.vorschlaege) === JSON.stringify(vorher),
    'c) Idempotenz: dieselben Vorschlaege (Tag@Start) vor und nach dem Speichern\n' +
    '        vorher:  ' + JSON.stringify(vorher) + '\n' +
    '        nachher: ' + JSON.stringify(nachSpeichern.vorschlaege));

  // -------------------------------------------------------------
  // d) Aendern+Speichern wirkt: "So" abwaehlen + Spaetestens 20:00 -> kein
  //    Vorschlag am Sonntag, keiner nach 20:00 (Nutzerbeispiel a der Abnahme).
  //    Frischer Bereich ohne vorhandenes Fenster, damit b)/c) nicht nachwirken.
  // -------------------------------------------------------------
  await p.evaluate(() => {
    const alltag = state.areas.find(a => a.id === 'a7');
    alltag.regeln = null;
    alltag.plan.days = [0,1,2,3,4,5,6];
    alltag.plan.from = null; alltag.plan.to = null;
    state.blocks = state.blocks.filter(b => !b.sug);
    save(); renderAll();
  });

  reihe = await oeffnen();
  await reihe.evaluate(r => {
    const so = [...r.querySelector('.gDays').querySelectorAll('button')]
      .find(b => b.textContent.trim() === 'So');
    so.click();
  });
  const bisIn = reihe.locator('.gTo');
  await bisIn.fill('20:00');
  await bisIn.dispatchEvent('input');
  await p.click('.sheet__foot button:has-text("Speichern")');
  await p.waitForTimeout(150);

  const d = await p.evaluate(() => {
    clearSuggestions();
    buildSuggestions();
    const sug = state.blocks.filter(b => b.sug && b.areaId === 'a7');
    return {
      anzahl: sug.length,
      sonntag: sug.filter(b => b.day === 6).length,
      nach20Start: sug.filter(b => b.start >= 20*60).length,
      nach20Ende: sug.filter(b => b.end > 20*60).length
    };
  });
  ok(d.anzahl > 0, 'd) es entstehen ueberhaupt Vorschlaege (' + d.anzahl + ')');
  ok(d.sonntag === 0, 'd) kein Vorschlag am Sonntag (' + d.sonntag + ')');
  ok(d.nach20Start === 0, 'd) kein Vorschlag beginnt nach 20:00 (' + d.nach20Start + ')');
  ok(d.nach20Ende === 0, 'd) kein Vorschlag endet nach 20:00 (' + d.nach20Ende + ')');

  // -------------------------------------------------------------
  // e) Abbrechen stellt ALLES zurueck — auch ein vorhandenes Fenster.
  // -------------------------------------------------------------
  await p.evaluate(() => {
    const sport = state.areas.find(a => a.id === 'a3');
    sport.plan.days = [0,1,2,3,4,5,6];
    sport.plan.from = null; sport.plan.to = null;
    sport.regeln = { fenster: [{ tage: [0,1,2,3,4], von: 9*60, bis: 18*60 }], anker: null };
    save();
  });
  const vorAbbrechen = await p.evaluate(() => {
    const sport = state.areas.find(a => a.id === 'a3');
    return { plan: JSON.parse(JSON.stringify(sport.plan)), regeln: JSON.parse(JSON.stringify(sport.regeln)) };
  });
  const idxSport = await p.evaluate(() => state.areas.findIndex(a => a.id === 'a3'));
  await p.evaluate(() => goalsSheet());
  await p.waitForTimeout(250);
  let sportRow = p.locator('#gList .goalrow').nth(idxSport);
  await sportRow.locator('.goalrow__more').click();
  await p.waitForTimeout(150);
  await sportRow.evaluate(r => {
    const so = [...r.querySelector('.gDays').querySelectorAll('button')]
      .find(b => b.textContent.trim() === 'So');
    so.click();
  });
  const sportVon = sportRow.locator('.gFrom');
  await sportVon.fill('06:00');
  await sportVon.dispatchEvent('input');
  await p.click('.sheet__foot button:has-text("Abbrechen")');
  await p.waitForTimeout(150);

  const nachAbbrechen = await p.evaluate(() => {
    const sport = state.areas.find(a => a.id === 'a3');
    return { plan: sport.plan, regeln: sport.regeln };
  });
  ok(JSON.stringify(nachAbbrechen.plan) === JSON.stringify(vorAbbrechen.plan),
    'e) Abbrechen stellt plan (Trio) unveraendert zurueck');
  ok(JSON.stringify(nachAbbrechen.regeln) === JSON.stringify(vorAbbrechen.regeln),
    'e) Abbrechen stellt ein vorhandenes area.regeln.fenster unveraendert zurueck (' +
    JSON.stringify(nachAbbrechen.regeln) + ')');

  // -------------------------------------------------------------
  // f) Gegenprobe: taskSheet() zeigt weiterhin seinen Fenster-Block.
  // -------------------------------------------------------------
  await p.evaluate(() => {
    state.tasks.push({ id: 'tk1', title: 'Testaufgabe', areaId: 'a2', done: false, frog: false });
    save();
  });
  await p.evaluate(() => taskSheet(state.tasks.find(t => t.id === 'tk1')));
  await p.waitForTimeout(200);
  await p.click("button:has-text('Wann genau?')");
  await p.waitForTimeout(150);
  const taskStruktur = await p.evaluate(() => {
    const wrap = document.getElementById('tkRegeln');
    return {
      hatRTage: !!wrap.querySelector('.rTage'),
      texte: [...wrap.querySelectorAll('.rTage button')].map(b => b.textContent.trim()),
      klammer: wrap.textContent.includes('zusätzlich zum Zeitraum oben')
    };
  });
  ok(taskStruktur.hatRTage, 'f) taskSheet() zeigt weiterhin den Fenster-Block (.rTage)');
  ok(taskStruktur.texte.join(',') === 'Mo,Di,Mi,Do,Fr,Sa,So',
    'f) taskSheet()-Fenster hat weiterhin eine Mo-So-Chipreihe (' + taskStruktur.texte.join(',') + ')');
  ok(!taskStruktur.klammer, 'f) auch im Aufgaben-Blatt keine "zusätzlich zum Zeitraum oben"-Klammer mehr');
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });

  // -------------------------------------------------------------
  // g) Konfliktfall: plan.to=10:00, altes Fenster 18:00-21:00 passt nicht in
  //    den Zeitraum. Saat muss 10:00 zeigen (NICHT 18:00/invertiert), eine
  //    Konfliktzeile muss sichtbar sein und beide Zeiten nennen, und
  //    unveraendertes Speichern darf p.to nie auf null verwerfen.
  // -------------------------------------------------------------
  await p.evaluate(() => {
    const alltag = state.areas.find(a => a.id === 'a7');
    alltag.plan.goal = 10; alltag.plan.must = true; alltag.plan.days = [0,1,2,3,4,5,6];
    alltag.plan.from = null; alltag.plan.to = 10*60;
    alltag.regeln = { fenster: [{ tage: [0,1,2,3,4,5], von: 18*60, bis: 21*60 }], anker: null };
    save(); renderAll();
  });
  reihe = await oeffnen();
  const gSaat = await reihe.evaluate(r => ({
    von: r.querySelector('.gFrom').value,
    bis: r.querySelector('.gTo').value,
    konfliktSichtbar: !r.querySelector('.gKonflikt').hidden,
    konfliktText: r.querySelector('.gKonflikt').textContent
  }));
  ok(gSaat.bis === '10:00', 'g) Saat zeigt Spaetestens 10:00, nicht invertiert (' + gSaat.bis + ')');
  ok(gSaat.von !== '18:00', 'g) Saat verschiebt Fruehestens nicht auf 18:00 (' + gSaat.von + ')');
  ok(gSaat.konfliktSichtbar, 'g) Konfliktzeile ist sichtbar');
  ok(gSaat.konfliktText.includes('18:00') && gSaat.konfliktText.includes('21:00'),
    'g) Konfliktzeile nennt die Alt-Fenster-Zeiten (' + JSON.stringify(gSaat.konfliktText) + ')');

  await p.click('.sheet__foot button:has-text("Speichern")');
  await p.waitForTimeout(150);
  const gNach = await p.evaluate(() => {
    const alltag = state.areas.find(a => a.id === 'a7');
    clearSuggestions();
    buildSuggestions();
    return {
      to: alltag.plan.to,
      regeln: alltag.regeln,
      nach10: state.blocks.filter(b => b.sug && b.areaId === 'a7' && b.start >= 10*60).length
    };
  });
  ok(gNach.to === 10*60, 'g) p.to bleibt 10:00, wird nie null (' + gNach.to + ')');
  ok(!gNach.regeln || !gNach.regeln.fenster, 'g) area.regeln.fenster ist geraeumt (' + JSON.stringify(gNach.regeln) + ')');
  ok(gNach.nach10 === 0, 'g) buildSuggestions() erzeugt keinen Vorschlag nach 10:00 (' + gNach.nach10 + ')');

  // -------------------------------------------------------------
  // h) Chip-Fortbestand: ein eingeschraenkter Bereich behaelt vor UND nach
  //    dem Speichern einen nichtleeren Chip, der Tage+Zeiten nennt (Fix 3 —
  //    vorher verschwand der Chip nach dem ersten Speichern, weil er nur
  //    area.regeln.fenster las, das dabei geraeumt wird).
  // -------------------------------------------------------------
  await p.evaluate(() => {
    const alltag = state.areas.find(a => a.id === 'a7');
    alltag.plan.days = [0,1,2]; alltag.plan.from = 9*60; alltag.plan.to = 17*60;
    alltag.regeln = null;
    save(); renderAll();
  });
  await p.evaluate(() => goalsSheet());
  await p.waitForTimeout(250);
  const chipVorImBlatt = await p.evaluate(idx => {
    return document.querySelectorAll('#gList .goalrow')[idx].querySelector('.goalrow__tags').textContent;
  }, idxAlltag);
  await p.click('.sheet__foot button:has-text("Speichern")');
  await p.waitForTimeout(150);
  await p.evaluate(() => goalsSheet());
  await p.waitForTimeout(250);
  const chipNach = await p.evaluate(idx => {
    return document.querySelectorAll('#gList .goalrow')[idx].querySelector('.goalrow__tags').textContent;
  }, idxAlltag);
  await p.click('.sheet__foot button:has-text("Abbrechen")');
  await p.waitForTimeout(150);
  ok(chipVorImBlatt.includes('Mo') && /\d\d:\d\d/.test(chipVorImBlatt),
    'h) Chip vor dem Speichern nennt Tage+Zeiten (' + JSON.stringify(chipVorImBlatt) + ')');
  ok(chipNach.includes('Mo') && /\d\d:\d\d/.test(chipNach),
    'h) Chip nach dem Speichern nennt weiterhin Tage+Zeiten (' + JSON.stringify(chipNach) + ')');

  // -------------------------------------------------------------
  // c2) Einmal-Umlegung: Bereich plan.days=alle + Fenster Mo-Mi, unveraendertes
  //     Speichern darf die Aufteilung neu falten (Fix 2, akzeptiert) — Summe
  //     der Vorschlagsminuten bleibt gleich, alle Vorschlaege liegen innerhalb
  //     Mo-Mi und innerhalb des Zeitfensters. Positionen DUERFEN sich aendern.
  // -------------------------------------------------------------
  const c2vorher = await p.evaluate(() => {
    const alltag = state.areas.find(a => a.id === 'a7');
    alltag.plan.goal = 5; alltag.plan.must = true; alltag.plan.days = [0,1,2,3,4,5,6];
    alltag.plan.from = null; alltag.plan.to = null; alltag.plan.grob = false;
    alltag.regeln = { fenster: [{ tage: [0,1,2], von: 8*60, bis: 20*60 }], anker: null };
    save(); renderAll();
    clearSuggestions(); buildSuggestions();
    const sug = state.blocks.filter(b => b.sug && b.areaId === 'a7');
    return { minuten: sug.reduce((s, b) => s + (b.end - b.start), 0) };
  });
  reihe = await oeffnen();
  await p.click('.sheet__foot button:has-text("Speichern")');
  await p.waitForTimeout(150);
  const c2nach = await p.evaluate(() => {
    clearSuggestions(); buildSuggestions();
    const sug = state.blocks.filter(b => b.sug && b.areaId === 'a7');
    return {
      minuten: sug.reduce((s, b) => s + (b.end - b.start), 0),
      alleMoMi: sug.every(b => b.day <= 2),
      alleImFenster: sug.every(b => b.start >= 8*60 && b.end <= 20*60)
    };
  });
  ok(c2nach.minuten === c2vorher.minuten,
    'c2) Gesamtminuten der Vorschlaege bleiben gleich (' + c2vorher.minuten + ' -> ' + c2nach.minuten + ')');
  ok(c2nach.alleMoMi, 'c2) alle Vorschlaege liegen innerhalb Mo-Mi');
  ok(c2nach.alleImFenster, 'c2) alle Vorschlaege liegen innerhalb des Zeitfensters 08:00-20:00');

  // -------------------------------------------------------------
  ok(konsolenfehler.length === 0, 'keine Konsolenfehler (' + konsolenfehler.join(' | ') + ')');

  await br.close();
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nAlle Pruefungen bestanden.');
  process.exit(fehler.length ? 1 : 0);
})();
