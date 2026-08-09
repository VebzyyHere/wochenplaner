// Feste Uhr (Montagmorgen, 2026-08-03T08:00:00+02:00) auch fuer die erste,
// hier lange vor dem SE/13-Teil unten entstandene Desktop-Seite: seit Stufe D
// kann der Erststart-Assistent ein Kapazitaets-Gate oeffnen, ein
// ungenagelter Lauf waere kalendertagabhaengig gruen oder rot.
const { chromium, devices } = require('playwright');
const path = require('path');
(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const p = await br.newPage({ viewport: { width: 1400, height: 950 }, timezoneId: 'Europe/Berlin' });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.clock.setFixedTime(new Date('2026-08-03T08:00:00+02:00'));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(500);
  // Onboarding durchklicken
  for (let i=0;i<4;i++) { await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(300); }
  await p.waitForTimeout(400);

  const vorher = await p.evaluate(() => {
    // Sonntag anwaehlen
    selectedDayIdx = 6; renderAll();
    const key = currentDayIso();
    return { tag: key, vorschlaegeDort: state.blocks.filter(b=>b.sug&&onDay(b,key,6)).length,
             frei: istFrei(key), schalter: document.getElementById('dayFrei').checked };
  });
  console.log('1) Sonntag vorher:', JSON.stringify(vorher));

  await p.click('#dayFrei');
  await p.waitForTimeout(400);
  const nachher = await p.evaluate(() => {
    const key = currentDayIso();
    return { frei: istFrei(key), label: document.getElementById('dayFreiLab').textContent,
             vorschlaegeDort: state.blocks.filter(b=>b.sug&&onDay(b,key,6)).length,
             kopfFrei: !!document.querySelector('.dayhead.is-frei'),
             spalteFrei: document.querySelectorAll('.daycol.is-frei').length,
             chipFrei: !!document.querySelector('.dayswitch__btn.is-frei'),
             toast: (document.querySelector('.toast')||{}).textContent };
  });
  console.log('2) Sonntag frei:', JSON.stringify(nachher));

  // Neu verteilen: darf den freien Tag nicht anfassen
  const neu = await p.evaluate(() => {
    clearSuggestions();
    state.areas.forEach(a => { if (a.plan.goal) a.plan.goal += 4; });
    const r = buildSuggestions();
    const key = currentDayIso();
    return { gesetzt: state.blocks.filter(b=>b.sug).length,
             amFreienTag: state.blocks.filter(b=>b.sug&&onDay(b,key,6)).length,
             verteiltAuf: [...new Set(state.blocks.filter(b=>b.sug).map(b=>b.date))].sort() };
  });
  console.log('3) Neu verteilt:', JSON.stringify(neu));

  // Von Hand eintragen bleibt erlaubt
  const hand = await p.evaluate(() => {
    const key = currentDayIso();
    state.blocks.push({ id: "handarbeit", title: "Brunch", areaId: "a6", day: 6,
      date: key, repeat: "none", start: 11*60, end: 13*60, frog: false, grob: false });
    save(); renderAll();
    return { drin: state.blocks.some(b=>b.id==="handarbeit"),
             sichtbar: [...document.querySelectorAll('.block__title')].some(x=>x.textContent==='Brunch') };
  });
  console.log('4) Von Hand eintragen:', JSON.stringify(hand));

  // Wieder freigeben
  await p.click('#dayFrei');
  await p.waitForTimeout(300);
  const zurueck = await p.evaluate(() => {
    const key = currentDayIso();
    return { frei: istFrei(key), imState: JSON.stringify(state.days[key]||{}),
             kopfFrei: !!document.querySelector('.dayhead.is-frei') };
  });
  console.log('5) Wieder verplanbar:', JSON.stringify(zurueck));

  await p.evaluate(() => { selectedDayIdx = 6; dayMeta(currentDayIso()).frei = true; save(); renderAll(); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'frei-desktop.png' });

  /* ============================================================
     Erweiterung (Auftrag A) — "bewusst frei" vs. "einfach leer".
     Ohne diese Unterscheidung sieht ein freigehaltener Tag in "Heute" und
     "Plan" genau wie ein vergessener aus, samt einladendem "Vorschlagen"-
     Knopf, der dort nichts ausloest (istFrei-Vertrag in buildSuggestions()).

     Eigener mobiler Kontext (iPhone SE), weil "Plan" nur am Handy einen
     einzelnen Tag zeigt (EINTAG_Q, max-width 640px) — am Desktop steht dort
     ohnehin die ganze Woche samt korrektem "FREI"-Kopf, siehe frei-desktop.png
     oben. Feste Uhr UND Zeitzone (Hausvertrag): "Heute" haengt an jetzt().
     ============================================================ */
  const fehler = [];
  const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

  const ctxSE = await br.newContext({ ...devices['iPhone SE'], timezoneId: 'Europe/Berlin' });
  const pSE = await ctxSE.newPage();
  const errsSE = [];
  pSE.on('pageerror', e => errsSE.push('PAGEERROR: ' + e.message));
  pSE.on('console', m => { if (m.type() === 'error') errsSE.push('CONSOLE: ' + m.text()); });
  await pSE.clock.setFixedTime(new Date('2026-08-08T10:00:00+02:00'));
  await pSE.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await pSE.waitForTimeout(500);
  // Der Erststart-Assistent oeffnet sich bei einem frischen Stand von selbst
  // (maybeWelcome()) — fuer die Screenshots muss er weg, sonst ueberdeckt er
  // die Ansicht darunter, die tagSetup() gleich neu aufsetzt.
  await pSE.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await pSE.waitForTimeout(200);

  // Frischer Zustand statt Erststart-Assistent: keine geerbten Bloecke, die
  // die beiden Testtage (Montag/Dienstag) verunreinigen koennten.
  async function tagSetup(idx, frei) {
    return pSE.evaluate(({ idx, frei }) => {
      state = freshState(); migrate(state);
      anchor = new Date();
      selectedDayIdx = idx;
      const key = currentDayIso();
      if (frei) dayMeta(key).frei = true;
      save(); setView('heute'); renderAll();
      return key;
    }, { idx, frei });
  }

  console.log('\n--- Montag: bewusst freigehalten, keine Eintraege ---');
  const freiKey = await tagSetup(0, true);
  const heuteFrei = await pSE.evaluate(() => ({
    html: $('#agenda').innerHTML, knopf: !!document.getElementById('agendaVorschlag')
  }));
  ok(heuteFrei.html.includes('Bewusst frei'), 'Heute/frei: neuer Satz "Bewusst frei" steht da');
  ok(!heuteFrei.html.includes('Noch nichts geplant'), 'Heute/frei: alter Text "Noch nichts geplant" ist weg');
  ok(!heuteFrei.knopf, 'Heute/frei: "Vorschlagen"-Knopf ist weg');

  await pSE.evaluate(() => setView('plan'));
  await pSE.waitForTimeout(150);
  const planFrei = await pSE.evaluate(() => $('.grid > .empty').innerHTML);
  ok(planFrei.includes('Bewusst frei'), 'Plan/frei: neuer Satz "Bewusst frei" steht da');
  ok(!planFrei.includes('Noch nichts geplant'), 'Plan/frei: alter Text "Noch nichts geplant" ist weg');

  // Screenshots des frei-Falls VOR dem Hand-Eintrag weiter unten -- sonst ist
  // der Tag nicht mehr leer und "Bewusst frei" faellt selbst zu Recht wieder weg.
  await pSE.screenshot({ path: 'frei-se-plan-frei.png' });
  await pSE.evaluate(() => setView('heute'));
  await pSE.waitForTimeout(150);
  await pSE.screenshot({ path: 'frei-se-heute-frei.png' });

  console.log('\n--- Gegenprobe Dienstag: schlicht leer, nicht freigehalten ---');
  const leerKey = await tagSetup(1, false);
  const heuteLeer = await pSE.evaluate(() => ({
    html: $('#agenda').innerHTML, knopf: !!document.getElementById('agendaVorschlag')
  }));
  ok(heuteLeer.html.includes('Noch nichts geplant'), 'Heute/leer: unveraendert -- "Noch nichts geplant" steht weiter da');
  ok(heuteLeer.knopf, 'Heute/leer: "Vorschlagen"-Knopf ist weiterhin da');
  ok(!heuteLeer.html.includes('Bewusst frei'), 'Heute/leer: kein "Bewusst frei" an einem einfach leeren Tag');
  await pSE.screenshot({ path: 'frei-se-heute-leer.png' });

  await pSE.evaluate(() => setView('plan'));
  await pSE.waitForTimeout(150);
  const planLeer = await pSE.evaluate(() => $('.grid > .empty').innerHTML);
  ok(planLeer.includes('Noch nichts geplant'), 'Plan/leer: unveraendert -- alter Text steht weiter da');
  ok(!planLeer.includes('Bewusst frei'), 'Plan/leer: kein "Bewusst frei" an einem einfach leeren Tag');
  await pSE.screenshot({ path: 'frei-se-plan-leer.png' });

  console.log('\n--- Von Hand eintragen bleibt am freigehaltenen Tag erlaubt (Handy) ---');
  await tagSetup(0, true); // Montag erneut bewusst frei, aber wieder leer
  const handMobil = await pSE.evaluate((key) => {
    selectedDayIdx = 0; // Montag, weiterhin bewusst frei
    state.blocks.push({ id: 'handarbeit-mobil', title: 'Kaffee', areaId: 'a6', day: 0,
      date: key, repeat: 'none', start: 9 * 60, end: 10 * 60, frog: false, grob: false });
    save(); setView('plan'); renderAll();
    return { drin: state.blocks.some(b => b.id === 'handarbeit-mobil'),
      sichtbar: [...document.querySelectorAll('.block__title')].some(x => x.textContent === 'Kaffee') };
  }, freiKey);
  ok(handMobil.drin && handMobil.sichtbar, 'Plan/frei (Handy): von Hand eingetragener Termin bleibt sichtbar');
  await ctxSE.close();

  // Dasselbe auf einem groesseren Geraet (iPhone 13 — bleibt unter der
  // 640px-Schwelle, zeigt "Plan" also weiterhin einzeln statt als Woche),
  // rein zur Sichtpruefung, keine zusaetzlichen Assertions.
  const ctx13 = await br.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Berlin' });
  const p13 = await ctx13.newPage();
  await p13.clock.setFixedTime(new Date('2026-08-08T10:00:00+02:00'));
  await p13.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p13.waitForTimeout(500);
  await p13.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p13.waitForTimeout(200);
  await p13.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = new Date(); selectedDayIdx = 0;
    dayMeta(currentDayIso()).frei = true;
    save(); setView('heute'); renderAll();
  });
  await p13.waitForTimeout(150);
  await p13.screenshot({ path: 'frei-13-heute-frei.png' });
  await p13.evaluate(() => setView('plan'));
  await p13.waitForTimeout(150);
  await p13.screenshot({ path: 'frei-13-plan-frei.png' });
  await p13.evaluate(() => {
    selectedDayIdx = 1; // Dienstag, ohne .frei -- Gegenprobe
    save(); setView('heute'); renderAll();
  });
  await p13.waitForTimeout(150);
  await p13.screenshot({ path: 'frei-13-heute-leer.png' });
  await p13.evaluate(() => setView('plan'));
  await p13.waitForTimeout(150);
  await p13.screenshot({ path: 'frei-13-plan-leer.png' });
  await ctx13.close();

  console.log('\nKonsolenfehler (Erweiterung):', errsSE.length ? errsSE : 'keine');
  console.log('Fehler (Erweiterung):', fehler.length ? fehler : 'keine');
  console.log('\nFehler (urspruengliche Pruefung):', errs.length ? errs : 'keine');
  await br.close();
  if (fehler.length || errsSE.length || errs.length) process.exit(1);
})();
