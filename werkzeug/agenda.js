/* ============================================================
   Prüfskript Agenda (Stufe 4) — iPhone SE (320x568)

   Prüft, was der Bericht zu Stufe 3+4 behauptet:
     a) Falz     — die Agenda passt ohne Scrollen über die Tabbar
     b) 44px     — jede antippbare Zeile ist mindestens fingergerecht
     c) Grob     — ein grober Eintrag zeigt den Abschnitt, keine Uhrzeit
     d) Ort      — Ort/Wegzeit erscheinen nur, wenn vorhanden
     e) Maskierung — Nutzertext geht sicher durch escapeHtml()
     f) days     — Wochen vorblättern legt keine neuen state.days an
     g) Langnamen — echte deutsche Bezeichner, kein Scrollen, kein Abschneiden

   Stil wie audit.js: eine Chromium-Seite, deutsche Ausgabe, Exit 1 bei Fehlern.
   Uhrzeit UND Datum sind über page.clock.setFixedTime() auf Mittwoch, 10 Uhr
   genagelt (wie in schleife.js/aufgabenverteiler.js) — sonst hängt Falz-Befund
   a) davon ab, wann jemand das Skript zufällig startet, statt an einer echten
   Vertragslücke; Abschnitt h) unten prüft den Abend absichtlich mit einer
   zweiten, eigenen festen Uhr (23 Uhr) statt die Falz für alle Zeiten wegzudefinieren.

   Anmerkung zu (a): der Auftrag nennt als untere Grenze ".dayswitch". Das
   Element steht laut Markup (~1243) zwar VOR ".main", sitzt seit Stufe 8
   aber per CSS-order (order:2, siehe .dayswitch/.tabbar) direkt über der
   Tabbar — am unteren, nicht mehr am oberen Bildschirmrand (siehe Messung
   unten). Trotzdem bleibt die feste Tabbar (".tabbar", unten, Daumenzone)
   die geprüfte Fuß-Kante: sie steht immer, .dayswitch nur bei data-tage="1"
   (sonst display:none, s. CSS). Geprüft wird deshalb Agenda-Unterkante <
   Tabbar-Oberkante; die Dayswitch-Werte werden zur Kontrolle mit ausgegeben.
   Siehe Bericht für die Begründung.

   Diese strenge Falz (a) gilt für die Standardschrift. Bei vergrößerter
   Systemschrift ist Scrollen die gewollte Folge größerer Schrift — dafür
   prüft schrift.js (Stufe 7) einen schwächeren, gestaffelten Vertrag statt
   dieser Falz. Siehe dort für die Begründung.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK   ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone SE'], timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  // Mittwoch, 10 Uhr — s. Kopfkommentar.
  await p.clock.setFixedTime(new Date('2026-08-05T10:00:00+02:00'));
  await p.goto(F); await p.waitForTimeout(500);

  // Erststart-Assistent wegklicken (wie audit.js)
  for (let i = 0; i < 3; i++) { await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(280); }
  await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(900);

  await p.evaluate(() => setView('heute'));
  await p.waitForTimeout(200);

  /* ---- f) Kein days-Wachstum beim Vorblättern ------------------------- */
  console.log('\n## f) days-Wachstum beim Vorblättern');
  const vorAnzahl = await p.evaluate(() => Object.keys(state.days).length);
  for (let i = 0; i < 3; i++) { await p.click('#nextWeek'); await p.waitForTimeout(150); }
  const nachAnzahl = await p.evaluate(() => Object.keys(state.days).length);
  console.log(`   state.days vorher: ${vorAnzahl}, nachher (3x Woche vor): ${nachAnzahl}`);
  ok(vorAnzahl === nachAnzahl, 'Anzahl state.days unverändert beim Vorblättern');
  // Woche zurücksetzen für die restlichen Prüfungen
  await p.evaluate(() => { anchor = new Date(); selectedDayIdx = (new Date().getDay() + 6) % 7; renderAll(); });
  await p.waitForTimeout(150);

  /* ---- Szenario 1: realistische Agenda (a, b, c, g) -------------------
     Tagfenster weiterhin auf 0–24 Uhr geweitet: ursprünglich, damit das
     Szenario unabhängig von der echten Uhrzeit beim Skriptlauf funktioniert.
     Seit die Uhr über page.clock fest auf 10 Uhr steht (s. Kopfkommentar) ist
     "jetzt" deterministisch — die Weitung bleibt trotzdem unschädlich stehen,
     statt die Fensterränder für alle drei Testblöcke neu durchzurechnen. */
  const sc1 = await p.evaluate(() => {
    const cap = m => Math.max(0, Math.min(1439, m));
    state.settings.dayStart = 0; state.settings.dayEnd = 24;
    state.settings.heimOrt = 'o-heim';
    state.orte = [{ id: 'o-heim', name: 'Zuhause' }, { id: 'o-sport', name: 'Sportzentrum Nord' }];
    state.wege = {}; state.wege[wegKey('o-heim', 'o-sport')] = 25;
    state.areas.find(a => a.id === 'a3').plan.ortId = 'o-sport';

    const dayKey = iso(addDays(mondayOf(anchor), selectedDayIdx));
    const jetzt = new Date().getHours() * 60 + new Date().getMinutes();
    const laufStart = cap(jetzt - 15), laufEnd = cap(laufStart + 60);
    // Fix an eine plausible Gym-Uhrzeit (17 Uhr) statt stur an laufEnd+30 —
    // läuft das Skript spät in der Nacht, würde sonst "Fitnessstudio" um
    // 2 oder 3 Uhr morgens erscheinen und die Sichtprüfung wertlos machen.
    // Fällt 17 Uhr vor "jetzt" (Skript läuft abends), bleibt laufEnd+30 der
    // Boden, damit der Eintrag weiter chronologisch nach dem laufenden liegt.
    const danachStart = cap(Math.max(17 * 60, laufEnd + 30)), danachEnd = cap(danachStart + 60);

    state.blocks = [
      { id: uid(), title: 'Vorlesung Statistik II', areaId: 'a2',
        day: selectedDayIdx, date: dayKey, repeat: 'none',
        start: laufStart, end: laufEnd, frog: false, grob: false },
      { id: uid(), title: 'Fitnessstudio Innenstadt', areaId: 'a3',
        day: selectedDayIdx, date: dayKey, repeat: 'none',
        start: danachStart, end: danachEnd, frog: false, grob: false },
      { id: uid(), title: 'Freunde', areaId: 'a6',
        day: selectedDayIdx, date: dayKey, repeat: 'none',
        grob: true, teil: 'ab', dauer: 90,
        start: abschnittVon('ab').von, end: abschnittVon('ab').von + 90, frog: false }
    ];
    state.tasks = [{ id: uid(), title: 'Hausarbeit Statistik fertig schreiben', areaId: 'a2', done: false, frog: true }];
    save(); renderAll();
    return { dayKey, jetzt, laufStart, laufEnd, danachStart, danachEnd };
  });
  console.log('\n## Szenario 1 (realistisch): ' + JSON.stringify(sc1));
  await p.waitForTimeout(200);

  /* ---- a) Falz ---------------------------------------------------------- */
  console.log('\n## a) Falz');
  const rects = await p.evaluate(() => {
    const R = sel => { const e = document.querySelector(sel); if (!e) return null;
      const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
    return {
      agenda: R('#agenda'), dayswitch: R('#daySwitch'), tabbar: R('#tabbar'),
      panelScrollTop: document.querySelector('.panel').scrollTop,
      windowH: window.innerHeight
    };
  });
  console.log('   ' + JSON.stringify(rects));
  ok(rects.panelScrollTop === 0, 'Panel ist ungescrollt (natürlicher Zustand geprüft)');
  ok(rects.agenda.bottom <= rects.tabbar.top,
    `Agenda-Unterkante (${rects.agenda.bottom.toFixed(1)}) liegt über Tabbar-Oberkante (${rects.tabbar.top.toFixed(1)})`);
  console.log(`   Zur Kontrolle: .dayswitch liegt bei top ${rects.dayswitch.top.toFixed(1)}–bottom ${rects.dayswitch.bottom.toFixed(1)} `
    + '(seit Stufe 8 unten über der Tabbar, nicht mehr am oberen Bildschirmrand — als Fußkante der Agenda trotzdem ungeeignet, s. Kommentar oben)');
  await p.screenshot({ path: 'ag-falz-hell.png' });

  /* ---- b) 44px Trefferflächen ------------------------------------------- */
  console.log('\n## b) Mindesthöhe antippbarer Agenda-Zeilen');
  const klein = await p.evaluate(() => {
    const zu = [];
    document.querySelectorAll('#agenda .agenda__row, #agenda .agenda__frog').forEach(el => {
      const h = el.getBoundingClientRect().height;
      if (h < 43.5) zu.push({ text: (el.textContent || '').trim().slice(0, 30), h: Math.round(h * 10) / 10 });
    });
    return zu;
  });
  ok(klein.length === 0, `Alle antippbaren Zeilen ≥ 44px (${klein.length} zu klein)`);
  if (klein.length) console.log('   ' + JSON.stringify(klein));

  /* ---- c) Grober Eintrag ohne Uhrzeit ------------------------------------ */
  console.log('\n## c) Grober Eintrag zeigt Abschnitt, keine Uhrzeit');
  const grobZeile = await p.evaluate(() => {
    const row = document.querySelector('#agenda .agenda__row--grob .agenda__time');
    return row ? row.textContent.trim() : null;
  });
  console.log('   Text: ' + JSON.stringify(grobZeile));
  ok(!!grobZeile && grobZeile.includes('abends'), 'enthält den Abschnittsnamen "abends"');
  ok(!!grobZeile && !/\d{1,2}:\d{2}/.test(grobZeile), 'enthält keine HH:MM-Uhrzeit');

  /* ---- g) Lange deutsche Namen ------------------------------------------ */
  console.log('\n## g) Lange deutsche Bezeichner');
  const langCheck = await p.evaluate(() => {
    const quer = document.documentElement.scrollWidth > window.innerWidth + 1;
    const clip = [];
    document.querySelectorAll('#agenda *').forEach(e => {
      if (e.children.length) return;
      if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible') {
        clip.push((e.textContent || '').trim().slice(0, 40));
      }
    });
    const heroTitle = document.querySelector('.agenda__hero-title');
    // Alle Danach-Titel, nicht nur den ersten: geprueft wird, ob lange deutsche
    // Namen vollstaendig ankommen — nicht, in welcher Reihenfolge der Verteiler
    // sie sortiert. Die Reihenfolge haengt an der Bewertung und darf sich aendern.
    const danachTitel = [...document.querySelectorAll('.agenda__row .agenda__title')]
      .map(e => e.textContent);
    return { quer, clip, heroTitle: heroTitle && heroTitle.textContent, danachTitel };
  });
  console.log('   ' + JSON.stringify(langCheck));
  ok(!langCheck.quer, 'kein waagerechtes Scrollen der Seite');
  ok(langCheck.clip.length === 0, 'kein abgeschnittener Text in der Agenda');
  ok(!!langCheck.heroTitle && langCheck.heroTitle.includes('Vorlesung Statistik II'), 'langer Titel im laufenden Eintrag vollständig');
  ok(langCheck.danachTitel.some(t => t.includes('Fitnessstudio Innenstadt')), 'langer Titel im Danach-Eintrag vollständig');

  const wegText = await p.evaluate(() => {
    const sub = document.querySelector('#agenda .agenda__row .agenda__sub');
    return sub ? sub.textContent : null;
  });
  console.log('   Ort+Wegzeit-Zeile: ' + JSON.stringify(wegText));
  ok(wegText === 'Sportzentrum Nord · 25 min Weg', 'Ort und Wegzeit korrekt zusammengesetzt');

  await p.screenshot({ path: 'ag-lang-hell.png' });
  await p.evaluate(() => { state.settings.theme = 'dark'; applyTheme(); });
  await p.waitForTimeout(150);
  await p.screenshot({ path: 'ag-falz-dunkel.png' });
  const dunkelKontrast = await p.evaluate(() => {
    const lab = document.querySelector('#agenda .agenda__sub, #agenda .agenda__label');
    return lab ? getComputedStyle(lab).color : null;
  });
  console.log('   Dunkelmodus, Mikrolabel-Farbe: ' + dunkelKontrast);
  await p.evaluate(() => { state.settings.theme = 'light'; applyTheme(); });

  /* ---- d) Ort/Wegzeit nur wenn vorhanden --------------------------------- */
  console.log('\n## d) Ort und Wegzeit nur, wenn vorhanden');
  const sc2 = await p.evaluate(() => {
    const cap = m => Math.max(0, Math.min(1439, m));
    state.settings.heimOrt = null;           // kein Rückfall-Ort mehr
    state.orte.push({ id: 'o-x', name: 'Irgendwo' });
    const dayKey = iso(addDays(mondayOf(anchor), selectedDayIdx));
    const jetzt = new Date().getHours() * 60 + new Date().getMinutes();
    const s1 = cap(jetzt + 30), e1 = cap(s1 + 30);
    const s2 = cap(e1 + 30), e2 = cap(s2 + 30);
    state.blocks = [
      { id: uid(), title: 'Mit Ort', areaId: 'a1', day: selectedDayIdx, date: dayKey,
        repeat: 'none', start: s1, end: e1, frog: false, grob: false, ortId: 'o-x' },
      { id: uid(), title: 'Ohne Ort', areaId: 'a4', day: selectedDayIdx, date: dayKey,
        repeat: 'none', start: s2, end: e2, frog: false, grob: false }
    ];
    state.tasks = [];
    save(); renderAll();
    return { dayKey, jetzt };
  });
  console.log('   ' + JSON.stringify(sc2));
  await p.waitForTimeout(200);
  const ortCheck = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#agenda .agenda__row')];
    const find = t => rows.find(r => (r.querySelector('.agenda__title') || {}).textContent === t);
    const mit = find('Mit Ort'), ohne = find('Ohne Ort');
    return {
      mitHatSub: mit ? !!mit.querySelector('.agenda__sub') : null,
      mitSubText: mit && mit.querySelector('.agenda__sub') ? mit.querySelector('.agenda__sub').textContent : null,
      ohneHatSub: ohne ? !!ohne.querySelector('.agenda__sub') : null,
      gefunden: { mit: !!mit, ohne: !!ohne }
    };
  });
  console.log('   ' + JSON.stringify(ortCheck));
  ok(ortCheck.gefunden.mit && ortCheck.gefunden.ohne, 'beide Testzeilen gefunden');
  ok(ortCheck.mitHatSub === true, 'Eintrag mit Ort zeigt eine zweite Zeile (' + ortCheck.mitSubText + ')');
  ok(ortCheck.ohneHatSub === false, 'Eintrag ohne Ort erzeugt KEINE (auch keine leere) zweite Zeile');

  /* ---- e) Maskierung ------------------------------------------------------ */
  console.log('\n## e) Maskierung eines bösartigen Titels');
  const boese = '<b>\'Test" & Co';
  const maskCheck = await p.evaluate((titel) => {
    state.tasks = [{ id: uid(), title: titel, areaId: 'a1', done: false, frog: true }];
    save(); renderAgenda();
    const el = document.querySelector('#agendaFrog');
    return el ? { text: el.textContent, html: el.innerHTML, kinder: el.children.length } : null;
  }, boese);
  console.log('   ' + JSON.stringify(maskCheck));
  ok(!!maskCheck && maskCheck.text === boese, 'Titel erscheint unverändert als Text');
  ok(!!maskCheck && maskCheck.kinder === 0, 'kein <b>-Kindelement im DOM entstanden');
  ok(!!maskCheck && !/<b>/.test(maskCheck.html), 'kein rohes <b>-Tag im innerHTML');

  /* ---- h) Abend (23 Uhr) mit Tagesabschluss: gestaffelter Vertrag ------
     Eigener Kontext mit eigener festen Uhr statt eines Zeitsprungs auf der
     laufenden Seite, damit Tagesabschluss an frischen Testblöcken hängt statt
     an Nebenwirkungen der Szenarien oben. Prüft den Befund zu Stufe 13: die
     ANTWORT (Heute zählt, laufender Eintrag, erste Danach-Zeile) bleibt ohne
     Scrollen sichtbar, der Tagesabschluss steht sichtbar DARUNTER statt sie
     zu verdrängen. Die volle Falz aus a) wird hier NICHT verlangt — laut
     Befund verlängert Tagesabschluss die Karte legitim, das scrollbare
     .panel fängt das ab (kein Produktfehler) — aber "irgendwo unsichtbar
     unten" bliebe trotzdem eine echte Regression, deshalb bleibt das geprüft. */
  console.log('\n## h) Abend (23 Uhr) mit Tagesabschluss: Antwort sichtbar, Tagesabschluss darunter');
  const ctx2 = await br.newContext({ ...devices['iPhone SE'], timezoneId: 'Europe/Berlin' });
  const p2 = await ctx2.newPage();
  const konsolenfehler2 = [];
  p2.on('pageerror', e => konsolenfehler2.push('PAGEERROR: ' + e.message));
  p2.on('console', m => { if (m.type() === 'error') konsolenfehler2.push('CONSOLE: ' + m.text()); });

  await p2.clock.setFixedTime(new Date('2026-08-05T23:00:00+02:00'));
  await p2.goto(F); await p2.waitForTimeout(500);
  for (let i = 0; i < 3; i++) { await p2.click('.sheet__foot .btn--primary'); await p2.waitForTimeout(280); }
  await p2.click('.sheet__foot .btn--primary'); await p2.waitForTimeout(900);
  await p2.evaluate(() => setView('heute'));
  await p2.waitForTimeout(200);

  const sc3 = await p2.evaluate(() => {
    const dayKey = iso(addDays(mondayOf(anchor), selectedDayIdx));
    // 22:40–23:35 läuft (klammert 23 Uhr ein), 23:50–23:59 danach — beide
    // bewusst nicht erledigt, damit offenHeute sicher nicht leer ist und
    // Tagesabschluss greift (state.settings.dayEnd bleibt Vorgabe 22 Uhr).
    state.blocks = [
      { id: uid(), title: 'Vorlesung Statistik II', areaId: 'a2',
        day: selectedDayIdx, date: dayKey, repeat: 'none',
        start: 22 * 60 + 40, end: 23 * 60 + 35, frog: false, grob: false },
      { id: uid(), title: 'Notizen nachtragen', areaId: 'a2',
        day: selectedDayIdx, date: dayKey, repeat: 'none',
        start: 23 * 60 + 50, end: 23 * 60 + 59, frog: false, grob: false }
    ];
    state.tasks = [{ id: uid(), title: 'Hausarbeit Statistik fertig schreiben', areaId: 'a2', done: false, frog: true }];
    save(); renderAll();
    return { dayKey };
  });
  console.log('   ' + JSON.stringify(sc3));
  await p2.waitForTimeout(200);

  const abend = await p2.evaluate(() => {
    const R = el => el ? el.getBoundingClientRect() : null;
    const sichtbar = el => {
      const r = R(el);
      return !!r && r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
    };
    const panel = document.querySelector('.panel');
    const label = document.querySelector('#agenda .agenda__label'); // "Heute zählt"
    const heroTitle = document.querySelector('#agenda .agenda__hero-title');
    const ersteDanachZeile = document.querySelector('#agenda .agenda__list .agenda__row');
    const abschlussLabel = [...document.querySelectorAll('#agenda .agenda__label')]
      .find(e => e.textContent === 'Tagesabschluss');
    return {
      heuteZaehltSichtbar: sichtbar(label),
      laufenderEintragSichtbar: sichtbar(heroTitle),
      laufenderEintragTitel: heroTitle ? heroTitle.textContent.trim() : null,
      ersteDanachZeileSichtbar: sichtbar(ersteDanachZeile),
      tagesabschlussVorhanden: !!abschlussLabel,
      tagesabschlussTop: abschlussLabel ? R(abschlussLabel).top : null,
      danachZeileBottom: ersteDanachZeile ? R(ersteDanachZeile).bottom : null,
      panelOverflowY: panel ? getComputedStyle(panel).overflowY : null,
      windowH: window.innerHeight
    };
  });
  console.log('   ' + JSON.stringify(abend));
  ok(abend.heuteZaehltSichtbar, '"Heute zählt" ohne Scrollen sichtbar (23 Uhr, mit Tagesabschluss)');
  ok(abend.laufenderEintragSichtbar, 'laufender Eintrag ohne Scrollen sichtbar (' + abend.laufenderEintragTitel + ')');
  ok(abend.ersteDanachZeileSichtbar, 'erste Danach-Zeile ohne Scrollen sichtbar');
  ok(abend.tagesabschlussVorhanden, 'Tagesabschluss ist überhaupt entstanden (Testdaten prüfen, falls nicht)');
  ok(!!abend.tagesabschlussTop && !!abend.danachZeileBottom && abend.tagesabschlussTop >= abend.danachZeileBottom,
    'Tagesabschluss steht sichtbar unter der Danach-Zeile, nicht davor (' + abend.tagesabschlussTop + ' >= ' + abend.danachZeileBottom + ')');
  ok(abend.panelOverflowY === 'auto' || abend.panelOverflowY === 'scroll',
    '.panel ist scrollbar (overflow-y: ' + abend.panelOverflowY + ') — Tagesabschluss bleibt erreichbar, auch wenn er unten abgeschnitten wird');

  console.log('\n=== Konsolenfehler (Abend-Kontext):', konsolenfehler2.length ? konsolenfehler2 : 'keine');
  if (konsolenfehler2.length) fehler.push('Konsolenfehler aufgetreten (Abend-Kontext)');
  await ctx2.close();

  console.log('\n=== Konsolenfehler:', konsolenfehler.length ? konsolenfehler : 'keine');
  if (konsolenfehler.length) fehler.push('Konsolenfehler aufgetreten');

  await br.close();

  console.log('\n' + (fehler.length ? `${fehler.length} FEHLER:` : 'Alle Prüfungen bestanden.'));
  fehler.forEach(f => console.log('  - ' + f));
  process.exit(fehler.length ? 1 : 0);
})();
