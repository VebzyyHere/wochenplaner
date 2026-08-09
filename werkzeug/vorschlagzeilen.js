/* ============================================================
   Prüfskript Vorschlagzeilen (Stufe B) — "Vorschläge sind da, wo du
   entscheidest".

   Prüft, was der Auftrag zu Stufe B behauptet:
     a) Fixture   — buildSuggestions() liefert Vorschläge, mindestens
                    einer heute, darunter ein grober (area.plan.grob=true).
     b) Sektion   — die Heute-Agenda zeigt eine eigene Sektion
                    "Vorschläge": Zeilenzahl === Zahl der heutigen
                    Vorschläge, die grobe Zeile trägt das Abschnittsformat
                    ("abends ~1,5 h"); steht daneben auch "Danach", sitzt
                    die Sektion darunter.
     c) ✓         — auf einer Zeile übernimmt über dieselbe Funktion wie
                    der ✓-Knopf im Raster (acceptOne) — Block verliert
                    sug, taucht in "Danach" auf, Sektionszähler sinkt,
                    areaMinutes zieht mit. Gegenprobe über den Rasterknopf:
                    identische Feldform hinterher.
     d) ×         — auf einer Zeile verwirft über dieselbe Funktion wie
                    der ×-Knopf im Raster (dropOne) — Block verschwindet
                    aus Sektion UND Raster, ein Grabstein entsteht in
                    state.tombs wie beim Raster-Weg.
     e) Leerzustand — leerer Tag + Vorschläge: "Noch nichts fest" statt
                    "Noch nichts geplant", kein "Vorschlagen"-Knopf. Ohne
                    Vorschläge: unverändert.
     f) Leistenlink — Tipp auf das Leisten-Label: body[data-mview] wird
                    "plan", selectedDayIdx zeigt auf den frühesten
                    Vorschlag; liegt der in einer anderen Woche, wandert
                    anchor dorthin.
     g) 44px      — die Trefferflächen der neuen ✓/×-Knöpfe sind effektiv
                    mindestens 44 x 44 (echte Box + unsichtbares ::before
                    unter pointer:coarse, Messmuster aus haken.js).

   Stil wie schleife.js/restdestag.js: eine Chromium-Seite, deutsche
   Ausgabe, Exit 1 bei Fehlern. Uhrzeit, Datum UND Zeitzone sind über
   page.clock.setFixedTime() (zoniertes Literal) und timezoneId auf
   Mittwoch, 2026-08-05, 10 Uhr, Europe/Berlin genagelt — sonst hinge
   jeder Befund hier vom Zufallszeitpunkt des Laufs ab. iPhone SE
   (320x568, hasTouch) durchgehend, wie haken.js/agenda.js — dieselbe
   Ansicht liefert nebenbei die geforderten Sichtproben.

   f) hat eine Besonderheit: die Gegenprobe "Vorschlag nur in der
   Folgewoche" kann nicht über einen echten Klick auf ein sichtbares
   Label laufen — hasSuggestions() (unverändert, wochenbezogen) blendet
   die Leiste aus, sobald die angezeigte Woche selbst keine Vorschläge
   hat, und genau das ist hier gewollt so. Geprüft wird deshalb
   springZumFruehestenVorschlag() direkt — derselben Funktion, die der
   Knopf aufruft, kein Duplikat der Sprunglogik.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone SE'], timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  // Mittwoch, 2026-08-05, 10 Uhr, Europe/Berlin — s. Kopfkommentar.
  await p.clock.setFixedTime(new Date('2026-08-05T10:00:00+02:00'));
  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  /* ==============================================================
     a) Fixture: buildSuggestions() liefert Vorschläge, mindestens
        einer heute, darunter ein grober.
     ============================================================== */
  console.log('=== a) Fixture: buildSuggestions() liefert Vorschläge ===');
  const a1 = await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: false };
    anchor = new Date();
    selectedDayIdx = (new Date().getDay() + 6) % 7;
    const heuteI = selectedDayIdx, heuteKey = iso(anchor);

    // Exakter Bereich mit Wochenziel, Fenster auf heute beschränkt —
    // deterministisch ein Vorschlag heute, unabhängig vom Verteiler-Score.
    const arbeit = state.areas.find(x => x.id === 'a1');
    arbeit.plan.goal = 1.5; arbeit.plan.days = [heuteI];

    // Grober Bereich (plan.grob = true), ebenfalls nur heute erlaubt.
    const hobby = state.areas.find(x => x.id === 'a4');
    hobby.plan.goal = 1.5; hobby.plan.days = [heuteI]; hobby.plan.grob = true;

    const r = buildSuggestions();
    save(); setView('heute'); renderAll();
    return {
      heuteKey, r,
      sug: state.blocks.filter(b => b.sug).map(b => ({ id: b.id, date: b.date, grob: !!b.grob }))
    };
  });
  console.log('   buildSuggestions(): ' + JSON.stringify(a1.r));
  console.log('   Vorschläge: ' + JSON.stringify(a1.sug));
  ok(a1.sug.length >= 1, 'a) mindestens ein Vorschlag existiert (' + a1.sug.length + ')');
  ok(a1.sug.every(b => b.date === a1.heuteKey), 'a) Fixture deterministisch: ALLE Vorschläge liegen heute (Fenster auf heute beschränkt)');
  ok(a1.sug.some(b => b.date === a1.heuteKey), 'a) mindestens ein Vorschlag liegt heute (' + a1.heuteKey + ')');
  ok(a1.sug.some(b => b.grob), 'a) mindestens ein grober Vorschlag existiert (area.plan.grob = true griff)');

  /* ==============================================================
     b) Heute-Ansicht zeigt die Sektion.
     ============================================================== */
  console.log('\n=== b) Heute-Ansicht zeigt die Vorschlags-Sektion ===');
  const b1 = await p.evaluate(() => {
    const labels = [...document.querySelectorAll('#agenda .agenda__label')].map(l => l.textContent);
    const rows = [...document.querySelectorAll('#agenda .agenda__row.is-vorschlag')];
    const grob = rows.find(r => (r.querySelector('.agenda__time') || {}).textContent === 'abends ~1,5 h');
    return {
      hatLabel: labels.includes('Vorschläge'),
      zeilenzahl: rows.length,
      heutigeSugAnzahl: state.blocks.filter(b => b.sug && b.date === iso(new Date())).length,
      hatGrobeZeile: !!grob
    };
  });
  console.log('   ' + JSON.stringify(b1));
  ok(b1.hatLabel, 'b) Label "Vorschläge" erscheint in der Agenda');
  ok(b1.zeilenzahl === b1.heutigeSugAnzahl, 'b) Zeilenzahl === Zahl der heutigen Vorschläge (' + b1.zeilenzahl + ' === ' + b1.heutigeSugAnzahl + ')');
  ok(b1.hatGrobeZeile, 'b) grobe Zeile trägt das Abschnittsformat ("abends ~1,5 h")');

  // b2) Platzierung unterhalb von "Danach", wenn der Tag nicht leer ist —
  // eigenes kleines Szenario mit einem echten, künftigen Termin heute
  // zusätzlich zu den Vorschlägen aus derselben Fixture.
  console.log('\n=== b2) Platzierung unterhalb von "Danach" (populierter Zweig) ===');
  const b2 = await p.evaluate(() => {
    const heuteI = selectedDayIdx, heuteKey = iso(new Date());
    state.blocks.push({ id: 'b2-echt', title: 'Zahnarzt', areaId: 'a1', day: heuteI, date: heuteKey,
      repeat: 'none', start: 20 * 60, end: 20 * 60 + 30, frog: false });
    save(); renderAll();
    const kinder = [...document.querySelector('#agenda').children];
    const danachIdx = kinder.findIndex(k => k.classList.contains('agenda__label') && k.textContent === 'Danach');
    const vorschlaegeIdx = kinder.findIndex(k => k.classList.contains('agenda__label') && k.textContent === 'Vorschläge');
    return { danachIdx, vorschlaegeIdx };
  });
  console.log('   ' + JSON.stringify(b2));
  ok(b2.danachIdx >= 0 && b2.vorschlaegeIdx >= 0, 'b2) sowohl "Danach" als auch "Vorschläge" erscheinen, wenn heute schon etwas Echtes steht');
  ok(b2.vorschlaegeIdx > b2.danachIdx, 'b2) "Vorschläge" steht im DOM nach "Danach" (Index ' + b2.vorschlaegeIdx + ' > ' + b2.danachIdx + ')');

  /* ==============================================================
     c) ✓ auf einer Zeile — Gegenprobe zum Raster-✓.
     ============================================================== */
  console.log('\n=== c) ✓ auf einer Zeile — Gegenprobe zum Raster-✓ ===');
  const c0 = await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: false };
    anchor = new Date();
    selectedDayIdx = (new Date().getDay() + 6) % 7;
    const heuteI = selectedDayIdx, heuteKey = iso(anchor);

    // Zwei strukturell gleiche, unabhängige Vorschläge in verschiedenen
    // Bereichen — einer wird über die Agenda-Zeile übernommen, der andere
    // über den Rasterknopf (Gegenprobe), damit sie sich nicht gegenseitig
    // beeinflussen.
    state.blocks = [
      { id: 'c-agenda', title: 'Sport A', areaId: 'a3', day: heuteI, date: heuteKey,
        repeat: 'none', start: 11 * 60, end: 12 * 60 + 30, frog: false, grob: false, sug: true, grund: 'Testgrund A' },
      { id: 'c-grid', title: 'Sport B', areaId: 'a4', day: heuteI, date: heuteKey,
        repeat: 'none', start: 13 * 60, end: 14 * 60 + 30, frog: false, grob: false, sug: true, grund: 'Testgrund B' }
    ];
    save(); setView('heute'); renderAll();
    return {
      zeilenVor: document.querySelectorAll('#agenda .agenda__row.is-vorschlag').length,
      a3: { real: areaMinutes('a3', false), sug: areaMinutes('a3', true) },
      a4: { real: areaMinutes('a4', false), sug: areaMinutes('a4', true) }
    };
  });
  console.log('   vorher: ' + JSON.stringify(c0));
  ok(c0.zeilenVor === 2, 'c) Ausgangslage: zwei Vorschlagszeilen in der Agenda (' + c0.zeilenVor + ')');
  ok(c0.a3.sug === 90 && c0.a3.real === 0, 'c) Ausgangslage a3: 90 sug, 0 real (' + JSON.stringify(c0.a3) + ')');
  ok(c0.a4.sug === 90 && c0.a4.real === 0, 'c) Ausgangslage a4: 90 sug, 0 real (' + JSON.stringify(c0.a4) + ')');

  await p.click('[data-vorschlag-ok="c-agenda"]', { timeout: 3000 });
  await p.waitForTimeout(150);
  const c1 = await p.evaluate(() => {
    const b = state.blocks.find(x => x.id === 'c-agenda');
    const eintraege = tagesAgenda(iso(new Date()), selectedDayIdx);
    return {
      block: b ? { sug: !!b.sug, fix: !!b.fix, repeat: b.repeat, start: b.start, end: b.end } : null,
      inDanach: eintraege.some(e => e.block.id === 'c-agenda'),
      zeilenNach: document.querySelectorAll('#agenda .agenda__row.is-vorschlag').length,
      a3: { real: areaMinutes('a3', false), sug: areaMinutes('a3', true) }
    };
  });
  console.log('   nach Agenda-✓: ' + JSON.stringify(c1));
  ok(!!c1.block && c1.block.sug === false, 'c) Block verliert sug nach Agenda-✓');
  ok(c1.inDanach, 'c) Block erscheint jetzt in der "Danach"-Liste');
  ok(c1.zeilenNach === 1, 'c) Sektionszähler sinkt von 2 auf 1 (' + c1.zeilenNach + ')');
  ok(c1.a3.real === 90 && c1.a3.sug === 0, 'c) areaMinutes zieht mit: a3 real 0->90, sug 90->0 (' + JSON.stringify(c1.a3) + ')');
  ok(!!c1.block && c1.block.start === 660 && c1.block.end === 750, 'c) Start/Ende unverändert durchs Übernehmen (' + c1.block.start + '-' + c1.block.end + ')');

  // Gegenprobe: derselbe Ablauf über den Rasterknopf.
  await p.evaluate(() => setView('plan'));
  await p.waitForTimeout(150);
  await p.click('.block[data-id="c-grid"] .block__sug button:first-child', { timeout: 3000 });
  await p.waitForTimeout(150);
  const c2 = await p.evaluate(() => {
    const b = state.blocks.find(x => x.id === 'c-grid');
    return {
      block: b ? { sug: !!b.sug, fix: !!b.fix, repeat: b.repeat, start: b.start, end: b.end } : null,
      a4: { real: areaMinutes('a4', false), sug: areaMinutes('a4', true) }
    };
  });
  console.log('   nach Raster-✓: ' + JSON.stringify(c2));
  ok(!!c2.block && c2.block.sug === false, 'c) Gegenprobe: Block verliert sug auch über den Rasterknopf');
  ok(c2.a4.real === 90 && c2.a4.sug === 0, 'c) Gegenprobe: areaMinutes zieht identisch mit (' + JSON.stringify(c2.a4) + ')');
  ok(!!c1.block && !!c2.block && c1.block.fix === c2.block.fix && c1.block.fix === false,
    'c) Gegenprobe: identische Feldform — keiner der beiden Wege setzt fix (' + c1.block.fix + ' / ' + c2.block.fix + ')');
  ok(!!c1.block && !!c2.block && c1.block.repeat === c2.block.repeat,
    'c) Gegenprobe: identische Feldform — repeat unverändert bei beiden (' + c1.block.repeat + ' / ' + c2.block.repeat + ')');

  /* ==============================================================
     d) × auf einer Zeile — Gegenprobe zum Raster-×.
     ============================================================== */
  console.log('\n=== d) × auf einer Zeile — Gegenprobe zum Raster-× ===');
  const d0 = await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: false };
    anchor = new Date();
    selectedDayIdx = (new Date().getDay() + 6) % 7;
    const heuteI = selectedDayIdx, heuteKey = iso(anchor);
    state.blocks = [
      { id: 'd-agenda', title: 'Lernen A', areaId: 'a2', day: heuteI, date: heuteKey,
        repeat: 'none', start: 11 * 60, end: 12 * 60, frog: false, grob: false, sug: true, grund: 'Testgrund' },
      { id: 'd-grid', title: 'Lernen B', areaId: 'a2', day: heuteI, date: heuteKey,
        repeat: 'none', start: 13 * 60, end: 14 * 60, frog: false, grob: false, sug: true, grund: 'Testgrund' }
    ];
    save(); setView('heute'); renderAll();
    return { tombsVor: Object.keys(state.tombs) };
  });

  await p.click('[data-vorschlag-nein="d-agenda"]', { timeout: 3000 });
  await p.waitForTimeout(150);
  const d1 = await p.evaluate((tombsVor) => ({
    existiertNoch: !!state.blocks.find(x => x.id === 'd-agenda'),
    zeilenNach: document.querySelectorAll('#agenda .agenda__row.is-vorschlag').length,
    tombNeu: !tombsVor.includes('d-agenda') && Object.prototype.hasOwnProperty.call(state.tombs, 'd-agenda'),
    tombTyp: typeof state.tombs['d-agenda']
  }), d0.tombsVor);
  console.log('   nach Agenda-×: ' + JSON.stringify(d1));
  ok(!d1.existiertNoch, 'd) Block ist aus state.blocks verschwunden (Agenda-×)');
  ok(d1.zeilenNach === 1, 'd) Sektionszähler sinkt von 2 auf 1 (' + d1.zeilenNach + ')');
  ok(d1.tombNeu, 'd) ein neuer Grabstein für den Block entsteht (state.tombs["d-agenda"])');
  ok(d1.tombTyp === 'number', 'd) der Grabstein trägt einen Zeitstempel (' + d1.tombTyp + ')');

  await p.evaluate(() => setView('plan'));
  await p.waitForTimeout(150);
  const d2 = await p.evaluate(() => !!document.querySelector('.block[data-id="d-agenda"]'));
  ok(!d2, 'd) Block ist auch im Raster weg');

  // Gegenprobe: Raster-×.
  const tombsVorGrid = await p.evaluate(() => Object.keys(state.tombs));
  await p.click('.block[data-id="d-grid"] .block__sug button:last-child', { timeout: 3000 });
  await p.waitForTimeout(150);
  const d3 = await p.evaluate((tombsVor) => ({
    existiertNoch: !!state.blocks.find(x => x.id === 'd-grid'),
    tombNeu: !tombsVor.includes('d-grid') && Object.prototype.hasOwnProperty.call(state.tombs, 'd-grid'),
    tombTyp: typeof state.tombs['d-grid']
  }), tombsVorGrid);
  console.log('   nach Raster-×: ' + JSON.stringify(d3));
  ok(!d3.existiertNoch, 'd) Gegenprobe: Block ist auch über den Rasterknopf verschwunden');
  ok(d3.tombNeu, 'd) Gegenprobe: auch hier entsteht ein Grabstein (state.tombs["d-grid"])');
  ok(d3.tombTyp === d1.tombTyp, 'd) Gegenprobe: derselbe Grabstein-Typ wie beim Agenda-Weg (' + d3.tombTyp + ' === ' + d1.tombTyp + ')');

  await p.evaluate(() => setView('heute'));
  await p.waitForTimeout(150);
  const d4 = await p.evaluate(() => document.querySelectorAll('#agenda .agenda__row.is-vorschlag').length);
  ok(d4 === 0, 'd) nach beiden Verwürfen: keine Vorschlagszeile mehr übrig (' + d4 + ')');

  /* ==============================================================
     e) Leerer Tag: Text und Knopf.
     ============================================================== */
  console.log('\n=== e) Leerer Tag: Text und Knopf ===');
  const e1 = await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: false };
    anchor = new Date();
    selectedDayIdx = (new Date().getDay() + 6) % 7;
    const heuteI = selectedDayIdx, heuteKey = iso(anchor);
    // Böswilliger Nutzertext (Randbedingung: escapeHtml()) — zwei
    // Vorschläge, einer davon grob, derselbe Tag.
    state.blocks = [
      { id: 'e-sug', title: '<img src=x onerror=alert(1)>Sport', areaId: 'a3', day: heuteI, date: heuteKey,
        repeat: 'none', start: 11 * 60, end: 12 * 60 + 30, frog: false, grob: false, sug: true, grund: '<b>Testgrund</b>' },
      { id: 'e-grob', title: 'Hobby', areaId: 'a4', day: heuteI, date: heuteKey,
        repeat: 'none', grob: true, teil: 'ab', dauer: 90, start: abschnittVon('ab').von, end: abschnittVon('ab').von + 90,
        frog: false, sug: true }
    ];
    save(); setView('heute'); renderAll();
    const empty = document.querySelector('#agenda .empty');
    const titleEl = document.querySelector('[data-vorschlag-ok="e-sug"]').closest('.agenda__row').querySelector('.agenda__title');
    const subEl = document.querySelector('[data-vorschlag-ok="e-sug"]').closest('.agenda__row').querySelector('.agenda__sub');
    return {
      ueberschrift: empty ? empty.querySelector('b').textContent : null,
      text: empty ? empty.textContent : null,
      hatVorschlagBtn: !!document.getElementById('agendaVorschlag'),
      hatSektion: [...document.querySelectorAll('#agenda .agenda__label')].some(l => l.textContent === 'Vorschläge'),
      titleText: titleEl ? titleEl.textContent : null,
      titleHtml: titleEl ? titleEl.innerHTML : null,
      subHtml: subEl ? subEl.innerHTML : null
    };
  });
  console.log('   ' + JSON.stringify(e1));
  ok(e1.ueberschrift === 'Noch nichts fest', 'e) Überschrift "Noch nichts fest" statt "Noch nichts geplant" (' + e1.ueberschrift + ')');
  ok(e1.text === 'Noch nichts fest2 Vorschläge für diesen Tag.', 'e) Text nennt die Zahl der heutigen Vorschläge (' + JSON.stringify(e1.text) + ')');
  ok(!e1.hatVorschlagBtn, 'e) "Vorschlagen"-Knopf entfällt, wenn Vorschläge da sind');
  ok(e1.hatSektion, 'e) die Vorschlags-Sektion erscheint trotzdem');
  ok(e1.titleText === '<img src=x onerror=alert(1)>Sport', 'e) Titel kommt als Text an (nicht ausgeführt)');
  ok(e1.titleHtml.indexOf('<img') === -1 && e1.titleHtml.indexOf('&lt;img') !== -1, 'e) Titel ist escaped im Markup (' + e1.titleHtml + ')');
  ok(e1.subHtml.indexOf('<b>') === -1 && e1.subHtml.indexOf('&lt;b&gt;') !== -1, 'e) Grund ist escaped im Markup (' + e1.subHtml + ')');

  // Gegenprobe: leer + KEINE Vorschläge -> alter Zustand samt Knopf.
  const e2 = await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: false };
    anchor = new Date();
    selectedDayIdx = (new Date().getDay() + 6) % 7;
    state.blocks = [];
    save(); setView('heute'); renderAll();
    const empty = document.querySelector('#agenda .empty');
    return {
      ueberschrift: empty ? empty.querySelector('b').textContent : null,
      hatVorschlagBtn: !!document.getElementById('agendaVorschlag'),
      hatSektion: [...document.querySelectorAll('#agenda .agenda__label')].some(l => l.textContent === 'Vorschläge')
    };
  });
  console.log('   Gegenprobe: ' + JSON.stringify(e2));
  ok(e2.ueberschrift === 'Noch nichts geplant', 'e) Gegenprobe: ohne Vorschläge bleibt "Noch nichts geplant" (' + e2.ueberschrift + ')');
  ok(e2.hatVorschlagBtn, 'e) Gegenprobe: "Vorschlagen"-Knopf bleibt da, wenn nichts vorliegt');
  ok(!e2.hatSektion, 'e) Gegenprobe: keine Vorschlags-Sektion ohne Vorschläge');

  /* ==============================================================
     f) Labeltipp springt zum frühesten Vorschlag.
     ============================================================== */
  console.log('\n=== f) Labeltipp springt zum frühesten Vorschlag ===');
  // f1) Vorschlag an einem ANDEREN Tag DERSELBEN Woche — echter Klick auf
  // das sichtbare Label.
  const f1setup = await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: false };
    anchor = new Date();
    const heuteI = (new Date().getDay() + 6) % 7;
    selectedDayIdx = heuteI;
    const montag = mondayOf(anchor);
    const zielI = (heuteI + 2) % 7;
    const zielTag = iso(addDays(montag, zielI));
    state.blocks = [
      { id: 'f1-sug', title: 'Uni', areaId: 'a2', day: zielI, date: zielTag,
        repeat: 'none', start: 9 * 60, end: 10 * 60, frog: false, grob: false, sug: true, grund: 'Testgrund' }
    ];
    save(); setView('heute'); renderAll();
    return { zielI, montagVorher: iso(mondayOf(anchor)) };
  });
  console.log('   Ausgangslage f1: ' + JSON.stringify(f1setup));
  const f1sichtbar = await p.evaluate(() => !!document.querySelector('.sugbar__text'));
  ok(f1sichtbar, 'f1) das Leisten-Label ist ein Knopf und im Bild (dieselbe Woche hat einen Vorschlag)');

  await p.click('.sugbar__text', { timeout: 3000 });
  await p.waitForTimeout(150);
  const f1 = await p.evaluate(() => ({
    mview: document.body.dataset.mview, selectedDayIdx, montagNachher: iso(mondayOf(anchor))
  }));
  console.log('   nach Klick f1: ' + JSON.stringify(f1));
  ok(f1.mview === 'plan', 'f1) body[data-mview] wird "plan" (' + f1.mview + ')');
  ok(f1.selectedDayIdx === f1setup.zielI, 'f1) selectedDayIdx zeigt auf den Tag des Vorschlags (' + f1.selectedDayIdx + ' === ' + f1setup.zielI + ')');
  ok(f1.montagNachher === f1setup.montagVorher, 'f1) anchor bleibt in derselben Woche (' + f1.montagNachher + ')');

  // f2) Gegenprobe: Vorschlag NUR in der Folgewoche. hasSuggestions() ist
  // wochenbezogen (unverändert) — die Leiste bleibt darum in der
  // angezeigten (leeren) Woche folgerichtig unsichtbar. Geprüft wird
  // deshalb springZumFruehestenVorschlag() direkt (dieselbe Funktion, die
  // der — hier unsichtbare — Knopf aufgerufen hätte).
  console.log('\n=== f2) Gegenprobe: Vorschlag nur in der Folgewoche ===');
  const f2setup = await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: false };
    anchor = new Date();
    selectedDayIdx = (new Date().getDay() + 6) % 7;
    const montagJetzt = mondayOf(anchor);
    const montagFolge = addDays(montagJetzt, 7);
    const zielI = 4;
    const zielTag = iso(addDays(montagFolge, zielI));
    state.blocks = [
      { id: 'f2-sug', title: 'Uni', areaId: 'a2', day: zielI, date: zielTag,
        repeat: 'none', start: 9 * 60, end: 10 * 60, frog: false, grob: false, sug: true, grund: 'Testgrund' }
    ];
    save(); setView('heute'); renderAll();
    return {
      montagJetzt: iso(montagJetzt), montagFolge: iso(montagFolge), zielI,
      hatSugAktuelleWoche: hasSuggestions(),
      leisteImBild: !!document.querySelector('.sugbar__text')
    };
  });
  console.log('   Ausgangslage f2: ' + JSON.stringify(f2setup));
  ok(!f2setup.hatSugAktuelleWoche, 'f2) Voraussetzung: die angezeigte Woche hat selbst keine Vorschläge');
  ok(!f2setup.leisteImBild, 'f2) Voraussetzung: die Leiste ist darum nicht im Bild (hasSuggestions() bleibt wochenbezogen)');

  const f2 = await p.evaluate(() => {
    springZumFruehestenVorschlag();
    return { mview: document.body.dataset.mview, selectedDayIdx, montagNachher: iso(mondayOf(anchor)) };
  });
  console.log('   nach springZumFruehestenVorschlag(): ' + JSON.stringify(f2));
  ok(f2.mview === 'plan', 'f2) body[data-mview] wird "plan" (' + f2.mview + ')');
  ok(f2.selectedDayIdx === f2setup.zielI, 'f2) selectedDayIdx zeigt auf den Tag des Vorschlags in der Folgewoche (' + f2.selectedDayIdx + ')');
  ok(f2.montagNachher === f2setup.montagFolge, 'f2) anchor wandert auf den Montag der Folgewoche (' + f2.montagNachher + ' === ' + f2setup.montagFolge + ')');

  /* ==============================================================
     g) Trefferflächen der neuen ✓/×-Knöpfe (>= 44 x 44).
     ============================================================== */
  console.log('\n=== g) Trefferflächen der ✓/×-Knöpfe (>= 44 x 44) ===');
  await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: false };
    anchor = new Date();
    selectedDayIdx = (new Date().getDay() + 6) % 7;
    const heuteI = selectedDayIdx, heuteKey = iso(anchor);
    state.blocks = [
      { id: 'g-sug', title: 'Sport', areaId: 'a3', day: heuteI, date: heuteKey,
        repeat: 'none', start: 11 * 60, end: 12 * 60 + 30, frog: false, grob: false, sug: true, grund: 'Testgrund' }
    ];
    save(); setView('heute'); renderAll();
  });
  await p.waitForTimeout(150);
  const treffer = await p.evaluate(() => {
    const messen = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el, '::before');
      const parse = v => v === 'auto' || !v ? 0 : parseFloat(v);
      let li = parse(cs.left), ri = parse(cs.right), ti = parse(cs.top), bi = parse(cs.bottom);
      if (cs.inset && cs.inset !== 'auto') {
        const teile = cs.inset.trim().split(/\s+/).map(parseFloat);
        const [t, rr, b2, l2] = teile.length === 1 ? [teile[0], teile[0], teile[0], teile[0]]
          : teile.length === 2 ? [teile[0], teile[1], teile[0], teile[1]]
          : teile.length === 3 ? [teile[0], teile[1], teile[2], teile[1]]
          : teile;
        ti = t; ri = rr; bi = b2; li = l2;
      }
      return {
        hatBefore: cs.content === '""',
        box: { w: r.width, h: r.height },
        erweitert: { w: r.width + Math.abs(li) + Math.abs(ri), h: r.height + Math.abs(ti) + Math.abs(bi) }
      };
    };
    return { ok: messen('[data-vorschlag-ok]'), nein: messen('[data-vorschlag-nein]') };
  });
  console.log('   ' + JSON.stringify(treffer));
  [['ok', treffer.ok], ['nein', treffer.nein]].forEach(([name, t]) => {
    if (!t) { ok(false, 'g) [' + name + ']: Knopf nicht gefunden'); return; }
    ok(t.hatBefore, 'g) [' + name + ']: hat ein ::before (pointer:coarse-Erweiterung greift)');
    ok(t.erweitert.w >= 44 && t.erweitert.h >= 44,
      'g) [' + name + ']: erweiterte Trefferfläche >= 44 x 44 (' + t.erweitert.w + ' x ' + t.erweitert.h + ')');
  });

  /* ==============================================================
     Sichtprobe: 320x568 (aktuelle Ansicht) + 375x812.
     ============================================================== */
  console.log('\n=== Sichtproben ===');
  await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: false };
    anchor = new Date();
    selectedDayIdx = (new Date().getDay() + 6) % 7;
    const heuteI = selectedDayIdx, heuteKey = iso(anchor);
    state.blocks = [
      { id: 'shot-echt', title: 'Zahnarzt', areaId: 'a1', day: heuteI, date: heuteKey,
        repeat: 'none', start: 18 * 60, end: 18 * 60 + 30, frog: false },
      { id: 'shot-exakt', title: 'Sport', areaId: 'a3', day: heuteI, date: heuteKey,
        repeat: 'none', start: 11 * 60, end: 12 * 60 + 30, frog: false, grob: false, sug: true,
        grund: 'Bester freier Platz diese Woche' },
      { id: 'shot-grob', title: 'Hobby', areaId: 'a4', day: heuteI, date: heuteKey,
        repeat: 'none', grob: true, teil: 'ab', dauer: 90, start: abschnittVon('ab').von, end: abschnittVon('ab').von + 90,
        frog: false, sug: true, grund: 'Abends, wie vorgenommen' }
    ];
    save(); setView('heute'); renderAll();
    // Die vorigen Abschnitte (c/d) haben über acceptOne()/dropOne() eigene
    // Toasts ausgelöst, die noch einige Sekunden nachleben (Muster wie
    // fuss.js) — für die Sichtprobe unbeteiligt, deshalb weg damit.
    document.querySelectorAll('.toasts .toast').forEach(t => t.remove());
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(__dirname, 'vorschlagzeilen-320x568.png') });
  await p.setViewportSize({ width: 375, height: 812 });
  await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(__dirname, 'vorschlagzeilen-375x812.png') });

  console.log('\n=== Konsolenfehler: ' + (konsolenfehler.length ? konsolenfehler.join(' | ') : 'keine'));
  if (konsolenfehler.length) fehler.push('Konsolenfehler aufgetreten');

  await br.close();
  if (fehler.length) { console.log('\n=== FEHLER (' + fehler.length + '):'); fehler.forEach(f => console.log(' - ' + f)); process.exit(1); }
  console.log('\nAlle Prüfungen bestanden.');
})();
