/* ============================================================
   Pruefskript Erklaer (Stufe 11) — die Begruendungszeile.

   a) Jeder platzierte Vorschlag hat einen nicht-leeren grund.
   b) Der Grund liest sich wie ein lesbarer deutscher Satz/Ausdruck,
      nicht wie ein Bezeichner oder ein Code-Fragment.
   c) Ein unloesbarer Fall (ein Bereich mit einem Fenster, das mit
      seinem Anker unvereinbar ist) liefert eine Handlungsanweisung,
      die den entscheidenden Filter benennt — nicht nur "nichts
      gefunden".
   d) Tippen auf einen Vorschlag zeigt zwei Alternativen mit
      Abzugsgrund und dem Knopf "Trotzdem hierhin"; ein Klick darauf
      verschiebt den Block wirklich dorthin.

   Stil wie regeln.js/wunsch.js: eine Chromium-Seite, deutsche
   Ausgabe, Exit 1 bei Fehlern.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

// Heuristik: sieht der Text wie ein Bezeichner oder Code-Fragment aus,
// statt wie ein lesbarer deutscher Satz/Ausdruck?
function wirktWieCode(text) {
  if (/[{};]|=>|\bfunction\b|\bundefined\b|\bNaN\b|\[object|null\b/.test(text)) return true;
  if (/^[a-z][a-zA-Z0-9]*$/.test(text)) return true;       // camelCase-Bezeichner, ein Wort
  if (!/\s/.test(text) && text.length < 20) return true;   // ein einzelnes kurzes Wort, kein Ausdruck
  return false;
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
  // a) + b): dieselbe Eingabe wie realtest.js.
  // -------------------------------------------------------------
  const ab = await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: true, from: 22 * 60 + 30, to: 6 * 60 + 30, wind: 30 };
    const set = (id, h, must, pad) => { const a = state.areas.find(x => x.id === id);
      a.plan.goal = h; a.plan.must = must; if (pad !== undefined) a.plan.pad = pad; };
    set("a1", 20, true, 60);
    set("a2", 12, true);
    set("a3", 4, true);
    set("a6", 4, true);
    set("a5", 8, false);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    save(); renderAll();
    clearSuggestions();
    buildSuggestions();
    save(); renderAll();

    const alle = state.blocks.filter(b => b.sug);
    return alle.map(b => ({ id: b.id, grob: !!b.grob, grund: b.grund }));
  });

  console.log('=== a)+b) Grund jedes Vorschlags ===');
  console.log('Vorschlaege insgesamt:', ab.length);
  ok(ab.length > 0, 'Voraussetzung: es entstehen ueberhaupt Vorschlaege (' + ab.length + ')');
  const ohneGrund = ab.filter(b => !b.grund || !String(b.grund).trim());
  ok(ohneGrund.length === 0, 'a) jeder Vorschlag hat einen nicht-leeren Grund (' +
    ohneGrund.length + ' ohne, von ' + ab.length + ')');
  const codeartig = ab.filter(b => b.grund && wirktWieCode(String(b.grund)));
  ok(codeartig.length === 0, 'b) kein Grund wirkt wie ein Bezeichner/Code-Fragment (' +
    codeartig.map(b => JSON.stringify(b.grund)).join(', ') + ')');
  console.log('Beispiele:', JSON.stringify([...new Set(ab.map(b => b.grund))].slice(0, 8), null, 1));

  // -------------------------------------------------------------
  // d) Tippen auf einen Vorschlag: zwei Alternativen mit Abzugsgrund
  //    und "Trotzdem hierhin" — ein Klick verschiebt den Block wirklich.
  //    Laeuft VOR c), weil c) den Zustand komplett zuruecksetzt — hier
  //    steht noch der Zustand aus a)+b), der reichlich Alternativen hat.
  // -------------------------------------------------------------
  const ziel = await p.evaluate(() => {
    const kandidat = state.blocks.find(b => b.sug && !b.grob && b.alternativen && b.alternativen.length === 2);
    if (!kandidat) return null;
    return { id: kandidat.id, date: kandidat.date, start: kandidat.start,
             alt: kandidat.alternativen.map(a => ({ day: a.day, date: a.date, start: a.start, grund: a.grund })) };
  });
  console.log('\n=== d) Alternativen im Vorschlags-Sheet ===');
  ok(!!ziel, 'Voraussetzung: es gibt einen Vorschlag mit zwei Alternativen');
  if (ziel) {
    console.log(JSON.stringify(ziel, null, 1));
    const grundLeer = ziel.alt.filter(a => !a.grund || !String(a.grund).trim());
    ok(grundLeer.length === 0, 'd) beide Alternativen haben einen nicht-leeren Abzugsgrund');
    const altCodeartig = ziel.alt.filter(a => a.grund && wirktWieCode(String(a.grund)));
    ok(altCodeartig.length === 0, 'd) kein Abzugsgrund wirkt wie ein Bezeichner/Code-Fragment (' +
      altCodeartig.map(a => JSON.stringify(a.grund)).join(', ') + ')');

    // Tippen: am Desktop ein normaler Klick auf den Block im Raster.
    await p.click('[data-id="' + ziel.id + '"]');
    await p.waitForTimeout(250);
    const sheet = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('#sugAlt > div')];
      return {
        offen: !!document.querySelector('.sheet'),
        anzahlZeilen: rows.length,
        knoepfe: rows.map(r => (r.querySelector('button') || {}).textContent),
        texte: rows.map(r => (r.querySelector('.agenda__sub') || {}).textContent)
      };
    });
    console.log('Vorschlags-Sheet:', JSON.stringify(sheet, null, 1));
    ok(sheet.offen, 'd) das Vorschlags-Sheet oeffnet sich beim Tippen');
    ok(sheet.anzahlZeilen === 2, 'd) genau zwei Alternativen werden angezeigt (' + sheet.anzahlZeilen + ')');
    ok(sheet.knoepfe.every(t => t === "Trotzdem hierhin"),
      'd) jede Alternative hat den Knopf "Trotzdem hierhin" (' + JSON.stringify(sheet.knoepfe) + ')');
    ok(sheet.texte.every(t => t && t.trim().length > 0),
      'd) jede Alternative zeigt ihren Grund im Sheet (' + JSON.stringify(sheet.texte) + ')');

    // Klick auf "Trotzdem hierhin" verschiebt den Block wirklich dorthin.
    await p.click('#sugAlt button:has-text("Trotzdem hierhin")');
    await p.waitForTimeout(250);
    const nachKlick = await p.evaluate((id) => {
      const b = state.blocks.find(x => x.id === id);
      const toastText = (document.querySelector('.toast span') || {}).textContent;
      return b ? { date: b.date, start: b.start, fix: !!b.fix, alternativenWeg: !b.alternativen, toastText } : null;
    }, ziel.id);
    console.log('Nach "Trotzdem hierhin":', JSON.stringify(nachKlick, null, 1));
    ok(!!nachKlick, 'd) der Block existiert nach dem Verschieben noch');
    if (nachKlick) {
      const erste = ziel.alt[0];
      ok(nachKlick.date === erste.date && nachKlick.start === erste.start,
        'd) der Block liegt jetzt exakt auf der gewaehlten Alternative');
      ok(nachKlick.fix, 'd) der Block ist danach fixiert (block.fix), sonst wuerfe der naechste Durchlauf ihn zurueck');
      ok(nachKlick.alternativenWeg, 'd) die jetzt ueberholte Alternativenliste ist geloescht');
    }
  }

  // -------------------------------------------------------------
  // c) Unloesbarer Fall: Fenster (8-9 Uhr) und Anker (30-120 Min nach
  //    Arbeitsende um 17:00, also 17:30-19:00) ueberschneiden sich an
  //    keinem Tag.
  // -------------------------------------------------------------
  const c = await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];

    const arbeit = state.areas.find(x => x.id === "a1");
    arbeit.plan.goal = 0;
    weekDays().filter(d => d.i <= 4).forEach(d => {   // Mo-Fr
      state.blocks.push({ id: uid(), title: "Arbeit", areaId: "a1",
        day: d.i, date: d.key, repeat: "none", start: 9 * 60, end: 17 * 60, frog: false });
    });

    const sport = state.areas.find(x => x.id === "a3");
    sport.plan.goal = 4; sport.plan.must = true; sport.plan.days = [0, 1, 2, 3, 4];
    sport.regeln = { fenster: [{ tage: [0, 1, 2, 3, 4], von: 8 * 60, bis: 9 * 60 }],
                      anker: { ref: "a1", min: 30, max: 120, sonst: "aus" } };

    save(); renderAll();
    clearSuggestions();
    const res = buildSuggestions();
    const sugSport = state.blocks.filter(b => b.sug && b.areaId === "a3");
    return { placed: res.placed, hinweise: res.hinweise, sugSportAnzahl: sugSport.length };
  });
  console.log('\n=== c) Unloesbarer Fall (Fenster vs. Anker) ===');
  console.log(JSON.stringify(c, null, 1));
  ok(c.sugSportAnzahl === 0, 'c) fuer Sport entsteht wie erwartet kein Vorschlag (' + c.sugSportAnzahl + ')');
  const hinweis = c.hinweise.find(h => h.startsWith("Sport"));
  ok(!!hinweis, 'c) es gibt eine Meldung fuer Sport (' + JSON.stringify(c.hinweise) + ')');
  if (hinweis) {
    ok(!/^Sport passt nicht\.?$/i.test(hinweis) && hinweis.length > 25,
      'c) die Meldung ist mehr als "nichts gefunden" (' + JSON.stringify(hinweis) + ')');
    ok(/Ohne (die Uhrzeit-Grenze|den Anker)/.test(hinweis),
      'c) die Meldung benennt den entscheidenden Filter (' + JSON.stringify(hinweis) + ')');
    ok(/\d{2}:\d{2}/.test(hinweis), 'c) die Meldung nennt eine konkrete Uhrzeit (' + JSON.stringify(hinweis) + ')');
  }

  console.log('\nKonsolenfehler:', konsolenfehler.length ? konsolenfehler : 'keine');
  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  await br.close();
  if (fehler.length || konsolenfehler.length) process.exit(1);
})();
