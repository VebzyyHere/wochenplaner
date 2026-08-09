/* ============================================================
   Prüfskript Grobstandard (Stufe C Punkt C1) — "Für Erholung ist das
   der bessere Standard": die Startbereiche der Art "erholung" (a4 Hobby,
   a5 Freizeit & Pausen, a6 Menschen) planen ab freshState() grob (ohne
   feste Uhrzeit), statt dass jeder neue Nutzer erst manuell umstellen
   muss. defaultPlan() selbst und der Bereichs-Editor bleiben unangetastet.

   a) Frischer Zustand: a4/a5/a6 (Art "erholung") haben plan.grob===true,
      a1/a2/a3/a7 (kopf/koerper/orga) plan.grob===false.
   b) migrate() 10x hintereinander ist idempotent — der Standard aus
      freshState() bleibt dabei Feld für Feld stehen.
   c) buildSuggestions() mit einem Wochenziel auf a5 erzeugt tatsächlich
      GROBE Vorschläge (b.grob===true, b.teil+b.dauer statt fester
      Uhrzeit) — der neue Standard wirkt bis in den Verteiler durch.
   d) Ein über den echten UI-Weg (#sAddArea) nutzer-angelegter neuer
      Bereich startet weiterhin mit plan.grob===false und Art "orga" —
      C1 ändert nur die Startbereiche in freshState(), nicht defaultPlan().

   Feste, zonierte Uhr (Muster serie.js/vorschlagzeilen.js): Mittwoch,
   2026-08-05, 10 Uhr, Europe/Berlin — buildSuggestions() in c) läuft
   zusätzlich in einer Zukunftswoche, damit "heute" dort keine Rolle
   spielt (Muster realtest.js/stabil.js). iPhone SE, deutsche Ausgabe,
   Exit 1 bei Fehlern.

   Rot-Beweis: `git stash` gegen HEAD (vor Stufe C) lässt a) rot laufen,
   weil freshState() dort a4/a5/a6 noch mit plan.grob===false anlegt
   (nur die v7-Migration setzt es, und die greift nur bei fehlendem
   Feld) — siehe Bericht.
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

  // Mittwoch, 2026-08-05, 10 Uhr, Europe/Berlin (wie vorschlagzeilen.js).
  await p.clock.setFixedTime(new Date('2026-08-05T10:00:00+02:00'));
  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  /* ==============================================================
     a) Frischer Zustand: plan.grob je Startbereich.
     ============================================================== */
  console.log('=== a) Frischer Zustand: plan.grob je Startbereich ===');
  const a = await p.evaluate(() => {
    const s = freshState();
    return s.areas.map(ar => ({ id: ar.id, name: ar.name, art: ar.plan.art, grob: ar.plan.grob }));
  });
  console.log('   ' + JSON.stringify(a));
  const ERHOLUNG = ['a4', 'a5', 'a6'];
  a.forEach(ar => {
    const soll = ERHOLUNG.includes(ar.id);
    ok(ar.grob === soll, 'a) ' + ar.id + ' "' + ar.name + '" (' + ar.art + '): plan.grob === ' + soll + ' (ist ' + ar.grob + ')');
  });

  /* ==============================================================
     b) migrate() 10x hintereinander — idempotent, Standard bleibt stehen.
     ============================================================== */
  console.log('\n=== b) migrate() 10x hintereinander bleibt idempotent ===');
  const b = await p.evaluate(() => {
    const s = freshState();
    const vorher = s.areas.map(ar => ({ id: ar.id, grob: ar.plan.grob }));
    for (let i = 0; i < 10; i++) migrate(s);
    const nachher = s.areas.map(ar => ({ id: ar.id, grob: ar.plan.grob }));
    return { vorher, nachher, version: s.version };
  });
  console.log('   version nach 10x migrate(): ' + b.version);
  ok(JSON.stringify(b.vorher) === JSON.stringify(b.nachher),
    'b) 10x migrate() ändert plan.grob an keinem Startbereich (' + JSON.stringify(b.nachher) + ')');

  /* ==============================================================
     c) buildSuggestions() mit Ziel auf a5 erzeugt GROBE Vorschläge.
     ============================================================== */
  console.log('\n=== c) buildSuggestions() auf a5 erzeugt grobe Vorschläge ===');
  const c = await p.evaluate(() => {
    state = freshState(); migrate(state);
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: false };
    anchor = addDays(mondayOf(new Date()), 7);   // Zukunftswoche, "heute" spielt keine Rolle
    const a5 = state.areas.find(x => x.id === 'a5');
    a5.plan.goal = 6; a5.plan.must = false;
    state.blocks = [];
    save(); renderAll();
    const r = buildSuggestions();
    const sugA5 = state.blocks.filter(x => x.sug && x.areaId === 'a5');
    return {
      r, anzahl: sugA5.length,
      alleGrob: sugA5.length > 0 && sugA5.every(x => x.grob === true),
      habenTeil: sugA5.length > 0 && sugA5.every(x => ABSCHNITTE.some(t => t.id === x.teil)),
      habenDauer: sugA5.length > 0 && sugA5.every(x => x.dauer > 0),
      beispiel: sugA5[0] ? { teil: sugA5[0].teil, dauer: sugA5[0].dauer, start: sugA5[0].start, end: sugA5[0].end } : null
    };
  });
  console.log('   buildSuggestions(): ' + JSON.stringify(c.r));
  console.log('   a5-Vorschläge: anzahl=' + c.anzahl + ' beispiel=' + JSON.stringify(c.beispiel));
  ok(c.anzahl > 0, 'c) a5 erzeugt überhaupt Vorschläge (' + c.anzahl + ')');
  ok(c.alleGrob, 'c) alle Vorschläge von a5 sind grob (b.grob === true)');
  ok(c.habenTeil, 'c) alle tragen einen gültigen Tagesabschnitt (b.teil) statt einer Uhrzeit');
  ok(c.habenDauer, 'c) alle tragen eine Dauer (b.dauer) statt fester Uhrzeit');

  /* ==============================================================
     d) Ein über den echten UI-Weg angelegter neuer Bereich startet
        weiterhin mit grob:false (defaultPlan() bleibt unangetastet).
     ============================================================== */
  console.log('\n=== d) Nutzer-angelegter neuer Bereich (#sAddArea) startet mit grob:false ===');
  await p.evaluate(() => {
    if (typeof closeModal === 'function') closeModal();
    state = freshState(); migrate(state);
    save(); renderAll();
  });
  await p.waitForTimeout(150);
  const vorAnzahl = await p.evaluate(() => state.areas.length);
  await p.click('#settingsBtn'); await p.waitForTimeout(400);
  await p.click('.setmenu__item >> nth=2'); await p.waitForTimeout(250);   // "Bereiche", s. SETTINGS_SEITEN
  await p.click('#sAddArea'); await p.waitForTimeout(300);
  const d = await p.evaluate((vorAnzahl) => {
    const neu = state.areas[state.areas.length - 1];
    return {
      neuAngelegt: state.areas.length === vorAnzahl + 1,
      grob: neu ? neu.plan.grob : null,
      art: neu ? neu.plan.art : null,
      name: neu ? neu.name : null
    };
  }, vorAnzahl);
  console.log('   ' + JSON.stringify(d));
  ok(d.neuAngelegt, 'd) über #sAddArea entsteht wirklich ein neuer Bereich (' + vorAnzahl + ' -> +1)');
  ok(d.grob === false, 'd) der neue Bereich startet mit plan.grob === false (ist ' + d.grob + ')');
  ok(d.art === 'orga', 'd) der neue Bereich startet als Art "orga" (' + d.art + ')');

  console.log('\nKonsolenfehler: ' + (konsolenfehler.length ? konsolenfehler.join(' | ') : 'keine'));
  if (konsolenfehler.length) fehler.push('Konsolenfehler aufgetreten');

  await br.close();
  if (fehler.length) { console.log('\n=== FEHLER (' + fehler.length + '):'); fehler.forEach(f => console.log(' - ' + f)); process.exit(1); }
  console.log('\nAlle Prüfungen bestanden.');
})();
