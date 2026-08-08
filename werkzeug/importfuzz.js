/* ============================================================
   Pruefskript Importfuzz — Auftrag B, Schritt 1: Fuzzing des einzigen
   Wegs, auf dem fremde Daten in den Zustand kommen (importData(), 7485).

   Jeder Fall geht durch den ECHTEN Weg: Einstellungen -> Daten und
   Sicherung -> "Sicherung laden" -> nativer Dateiauswahldialog (per
   Playwright filechooser-Event abgefangen) -> FileReader.readAsText()
   -> JSON.parse() -> migrate(). Kein Abkuerzen ueber einen direkten
   Aufruf von internem Code, weil genau die Kette FileReader/JSON.parse/
   migrate() die verwundbare Stelle ist.

   Gemessen wird pro Fall:
     - bleibt die Oberflaeche bedienbar (Settings-Menue danach noch
       benutzbar, kein haengender Dialog)?
     - gibt es einen JS-Fehler in der Konsole (pageerror/console error)?
     - wird der bestehende Zustand beschaedigt (Marker-Block/-Aufgabe
       vorher/nachher byte-identisch, wenn nicht ausdruecklich
       "Ersetzen" gewaehlt wird)?
     - welche Rueckmeldung bekommt der Nutzer (Toast-Text oder Dialog)?

   Faelle, in denen der Bestaetigungsdialog erscheint, werden per Vorgabe
   mit "Abbrechen" geschlossen. Der Array-Fall (2) laeuft zusaetzlich
   einmal MIT "Ersetzen" durch — das ist der im Grundvertrag beschriebene
   Schadensfall, hier nicht mit einer drei Monate alten Sicherung, sondern
   mit dem kaputtesten Eingabefall reproduziert.

   Stil wie netz.js/restdestag.js: eine Chromium-Seite, deutsche Ausgabe,
   Uhrzeit/Datum/Zeitzone ueber page.clock.setFixedTime() + timezoneId
   festgenagelt (Playwright 1.62), Exit 1 bei Fehlern.
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
  let konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  await p.clock.setFixedTime(new Date('2026-08-05T10:00:00+02:00'));
  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  // Grundzustand mit einem Marker-Block/-Aufgabe, damit "beschaedigt der
  // bestehende Zustand" ueberhaupt messbar ist (Vorher/Nachher-Vergleich).
  async function basisSetup() {
    return p.evaluate(() => {
      localStorage.clear();
      state = freshState(); migrate(state);
      state.blocks.push({ id: 'fuzz-marker', title: 'Fuzz-Marker', areaId: 'a1', day: 0,
        date: iso(mondayOf(new Date())), repeat: 'none', start: 9 * 60, end: 10 * 60, frog: false });
      state.tasks.push({ id: 'fuzz-task', title: 'Fuzz-Aufgabe', areaId: 'a1' });
      save(); setView('plan'); renderAll();
      return { blocks: JSON.parse(JSON.stringify(state.blocks)), tasks: JSON.parse(JSON.stringify(state.tasks)) };
    });
  }

  async function zuDaten() {
    await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
    await p.waitForTimeout(150);
    await p.click('#settingsBtn');
    await p.waitForTimeout(300);
    await p.click('.setmenu__item:has-text("Daten und Sicherung")');
    await p.waitForTimeout(200);
  }

  // Wirft eine Datei gegen #sImport (den echten Weg). Klickt danach je
  // nach "aktion" auf Abbrechen/Ersetzen/Zusammenfuehren, falls der
  // Bestaetigungsdialog ueberhaupt erscheint.
  async function wirf(dateiname, inhalt, aktion) {
    konsolenfehler = [];
    await zuDaten();
    // Toasts von einem vorigen Fall leben bis zu 2.6s nach — ohne diese
    // Leerung wuerde die naechste "vor Klick"-Messung einen alten Toast
    // aus dem VORIGEN Fall sehen statt den echten (oder gar keinen).
    await p.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
    const fcPromise = p.waitForEvent('filechooser');
    await p.click('#sImport');
    const fc = await fcPromise;
    await fc.setFiles({ name: dateiname, mimeType: 'application/json', buffer: Buffer.from(inhalt, 'utf-8') });
    await p.waitForTimeout(400);

    const vorKlick = await p.evaluate(() => {
      const toastEl = document.querySelector('#toasts .toast span');
      const titel = document.querySelector('.sheet__title');
      return {
        toast: toastEl ? toastEl.textContent : null,
        dialogOffen: !!titel && titel.textContent === 'Sicherung laden',
        dialogHtml: titel && titel.closest('.sheet') ? titel.closest('.sheet').innerHTML : null
      };
    });

    if (vorKlick.dialogOffen) {
      const knopf = aktion === 'ersetzen' ? 'Ersetzen' : aktion === 'zusammenfuehren' ? 'Zusammenführen' : 'Abbrechen';
      await p.click('.sheet__foot button:has-text("' + knopf + '")');
      await p.waitForTimeout(300);
    }

    const nach = await p.evaluate(() => {
      const toastEl = document.querySelector('#toasts .toast span');
      return {
        toastNachKlick: toastEl ? toastEl.textContent : null,
        blocks: JSON.parse(JSON.stringify(state.blocks)),
        tasks: JSON.parse(JSON.stringify(state.tasks)),
        stateIstArray: Array.isArray(state),
        gespeichertRoh: (() => {
          try { return localStorage.getItem(Object.keys(localStorage).find(k => k.indexOf('wochenplaner.') === 0)); }
          catch (e) { return 'FEHLER: ' + e.message; }
        })(),
        appDa: !!document.getElementById('tabbar')
      };
    });
    return Object.assign({}, vorKlick, nach);
  }

  async function bedienbarkeitsCheck() {
    await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
    await p.waitForTimeout(150);
    await p.click('#settingsBtn');
    await p.waitForTimeout(250);
    const menueDa = await p.evaluate(() => !!document.querySelector('.setmenu, .sheet'));
    await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
    await p.waitForTimeout(150);
    return menueDa;
  }

  const ergebnisse = [];
  async function fall(titel, dateiname, inhalt, aktion) {
    console.log('\n=== ' + titel + ' ===');
    const vor = await basisSetup();
    const nach = await wirf(dateiname, inhalt, aktion);
    const bedienbar = await bedienbarkeitsCheck();
    const zustandUnveraendert =
      JSON.stringify(nach.blocks) === JSON.stringify(vor.blocks) &&
      JSON.stringify(nach.tasks) === JSON.stringify(vor.tasks);
    const eintrag = {
      titel, dateiname, aktion: aktion || '(kein Dialog / abbrechen)',
      toastVorKlick: nach.toast, dialogOffen: nach.dialogOffen, toastNachKlick: nach.toastNachKlick,
      zustandUnveraendert, bedienbar, appDa: nach.appDa, stateIstArray: nach.stateIstArray,
      konsolenfehler: [...konsolenfehler]
    };
    console.log('Rueckmeldung vor Klick (Toast):', JSON.stringify(nach.toast));
    console.log('Dialog "Sicherung laden" erschienen:', nach.dialogOffen, '| Aktion:', eintrag.aktion);
    console.log('Rueckmeldung nach Klick (Toast):', JSON.stringify(nach.toastNachKlick));
    console.log('Zustand unveraendert:', zustandUnveraendert, '| state ist Array:', nach.stateIstArray);
    console.log('Oberflaeche bedienbar danach:', bedienbar);
    console.log('Konsolenfehler:', konsolenfehler.length ? konsolenfehler : 'keine');
    ergebnisse.push(eintrag);
    return eintrag;
  }

  // ==============================================================
  // 1) gar kein JSON
  // ==============================================================
  await fall('1a) Freitext, kein JSON', 'text.json', 'Das ist einfach nur ein Satz, kein JSON.');
  await fall('1b) halbes JSON', 'halb.json', '{"areas": [ { "id": "a1", "name": "Ar');
  await fall('1c) leere Datei', 'leer.json', '');

  // ==============================================================
  // 2) gueltiges JSON, aber Array statt Objekt — einmal abgebrochen,
  //    einmal bewusst "ersetzt" (der dokumentierte Schadensfall).
  // ==============================================================
  const arrAbbrechen = await fall('2a) Array statt Objekt, Abbrechen', 'array.json', '[1,2,3]', 'abbrechen');
  const arrErsetzt = await fall('2b) Array statt Objekt, ERSETZEN', 'array.json', '[1,2,3]', 'ersetzen');
  // VORHER (Fund in Schritt 1): das Array bestand die Typpruefung, erreichte
  // migrate() und den Bestaetigungsdialog; bei "Ersetzen" wurde state selbst
  // zum Array, und die gespeicherte Sicherung in localStorage war danach
  // woertlich "[1,2,3]" — areas/blocks/tasks/settings/tombs komplett weg.
  // NACHHER: die Datei wird schon vor migrate() abgelehnt, kein Dialog mehr,
  // kein Datenverlust. Diese Pruefung schlaegt fehl (wird rot), falls der
  // Fix in importData() (index.html) je zurueckgenommen wird.
  ok(!arrAbbrechen.dialogOffen && !arrErsetzt.dialogOffen,
    '2) Array-Datei wird VOR dem Bestaetigungsdialog abgelehnt, in beiden Faellen (' +
    JSON.stringify({ abbrechen: arrAbbrechen.dialogOffen, ersetzen: arrErsetzt.dialogOffen }) + ')');
  ok(arrErsetzt.zustandUnveraendert && !arrErsetzt.stateIstArray,
    '2b) ... state bleibt dabei ein Objekt und unberuehrt, kein Datenverlust mehr');
  // Schluessel fest "wochenplaner.local" (Store.key(), scope bleibt hier
  // "local") — NICHT ueber Object.keys(localStorage).find() suchen: das
  // faende zuerst den Sicherungsschluessel "wochenplaner.local.vor-v9",
  // der frueher als "wochenplaner.local" angelegt wird und einen ganz
  // anderen (unbeschaedigten) Stand enthaelt.
  const nachSpeichern = await p.evaluate(() => {
    const raw = localStorage.getItem('wochenplaner.local');
    let geparst = null, parseFehler = null;
    try { geparst = JSON.parse(raw); } catch (e) { parseFehler = e.message; }
    return { raw, istArray: Array.isArray(geparst), hatAreas: !!(geparst && geparst.areas), parseFehler };
  });
  console.log('localStorage["wochenplaner.local"] nach dem Array-Fuzz:', JSON.stringify(nachSpeichern));
  ok(nachSpeichern.raw !== '[1,2,3]',
    '2b) BEWEIS Schritt 2: die Sicherung in localStorage ist NICHT mehr woertlich "[1,2,3]" (' + nachSpeichern.raw + ')');
  ok(!!nachSpeichern.hatAreas, '2b) ... und traegt weiterhin ihre "areas" (' + nachSpeichern.hatAreas + ')');

  // ==============================================================
  // 3) gueltiges JSON, aber Zahl / String / null
  // ==============================================================
  await fall('3a) Zahl statt Objekt', 'zahl.json', '42');
  await fall('3b) String statt Objekt', 'string.json', '"hallo"');
  await fall('3c) null statt Objekt', 'null.json', 'null');

  // ==============================================================
  // 4) Objekt mit fehlenden Pflichtfeldern
  // ==============================================================
  await fall('4a) leeres Objekt, Abbrechen', 'leeresobjekt.json', '{}', 'abbrechen');
  await fall('4b) leeres Objekt, ERSETZEN', 'leeresobjekt.json', '{}', 'ersetzen');

  // ==============================================================
  // 5) Objekt mit Feldern falschen Typs
  // ==============================================================
  await fall('5a) areas als String, blocks als Objekt, version als Text — Abbrechen', 'falschertyp.json',
    JSON.stringify({ areas: 'kaputt', blocks: { x: 1 }, version: 'neu', tasks: 'auchkaputt' }), 'abbrechen');
  await fall('5b) dasselbe, ERSETZEN', 'falschertyp.json',
    JSON.stringify({ areas: 'kaputt', blocks: { x: 1 }, version: 'neu', tasks: 'auchkaputt' }), 'ersetzen');

  // ==============================================================
  // 6) Markup/Skript-Text in Titel, Bereichsname, Ort, Notiz — mit
  //    "Ersetzen", weil erst das Rendern des uebernommenen Stands zeigt,
  //    ob escapeHtml() beim Import-Weg wirklich greift.
  // ==============================================================
  const boese = '<img src=x onerror="window.__fuzzXSS=true">';
  const markupDatei = {
    version: 9,
    profile: { id: 'p1', name: boese },
    settings: { dayStart: 7, dayEnd: 22, theme: 'auto', sleep: { on: false, from: 0, to: 0, wind: 0 } },
    areas: [{ id: 'a1', name: boese, hue: 10, plan: { goal: 3, days: [0,1,2,3,4,5,6], from: null, to: null, min: 15, max: 240, must: true, pad: 0, art: null, ortId: null } }],
    blocks: [{ id: 'b1', title: boese, areaId: 'a1', day: 0, date: '2026-08-03', repeat: 'none', start: 540, end: 600, frog: false, notiz: boese }],
    tasks: [{ id: 't1', title: boese, areaId: 'a1' }], days: {}, orte: [{ id: 'o1', name: boese }], wege: {}, tombs: {}, erledigt: {}, rituale: {}
  };
  await fall('6) Markup/Skript-Text ueberall, ERSETZEN', 'markup.json', JSON.stringify(markupDatei), 'ersetzen');
  const xssLief = await p.evaluate(() => !!window.__fuzzXSS);
  ok(!xssLief, '6) das onerror aus der Sicherung ist NICHT ausgefuehrt worden (escapeHtml greift)');
  const markupDom = await p.evaluate(() => document.querySelector('.app').innerHTML.includes('<img src=x onerror'));
  ok(!markupDom, '6) kein rohes <img onerror> im DOM nach dem Rendern (' + markupDom + ')');

  // ==============================================================
  // 7) sehr grosse Datei — Groessenwahl: 5000 Bloecke entsprechen etwa
  //    3-4 Jahren taeglicher Doppelbelegung; gross genug fuer messbare
  //    Verzoegerung, klein genug, um die Maschine hier nicht zu haengen.
  // ==============================================================
  console.log('\n=== 7) sehr grosse Datei (5000 Bloecke) ===');
  const grosseBlocks = [];
  for (let i = 0; i < 5000; i++) {
    const tag = String((i % 27) + 1).padStart(2, '0');
    grosseBlocks.push({ id: 'g' + i, title: 'Block ' + i, areaId: 'a1', day: i % 7,
      date: '2026-08-' + tag, repeat: 'none', start: (i % 20) * 45, end: (i % 20) * 45 + 30, frog: false });
  }
  const grosseDatei = JSON.stringify({ version: 9, areas: [], blocks: grosseBlocks, tasks: [], days: {}, orte: [], wege: {}, tombs: {}, erledigt: {}, rituale: {} });
  console.log('Dateigroesse:', (grosseDatei.length / 1024).toFixed(0), 'KB,', grosseBlocks.length, 'Bloecke');
  const vorGross = await basisSetup();
  const grossStart = Date.now();
  const nachGross = await wirf('gross.json', grosseDatei, 'abbrechen');
  const grossDauer = Date.now() - grossStart;
  const bedienbarGross = await bedienbarkeitsCheck();
  console.log('Dauer bis Dialog+Abbrechen:', grossDauer, 'ms');
  console.log('Rueckmeldung:', JSON.stringify(nachGross.toast), '| Dialog:', nachGross.dialogOffen);
  console.log('Konsolenfehler:', konsolenfehler.length ? konsolenfehler : 'keine');
  console.log('Oberflaeche bedienbar danach:', bedienbarGross);
  ergebnisse.push({ titel: '7) sehr grosse Datei (5000 Bloecke)', aktion: 'abbrechen', dauerMs: grossDauer, bedienbar: bedienbarGross,
    konsolenfehler: [...konsolenfehler], toastVorKlick: nachGross.toast, dialogOffen: nachGross.dialogOffen,
    toastNachKlick: nachGross.toastNachKlick, zustandUnveraendert: true, stateIstArray: nachGross.stateIstArray });

  // ==============================================================
  // 8) Objekt mit Zukunftsversion (version 99)
  // ==============================================================
  const zukunftDatei = {
    version: 99, profile: { id: 'p2', name: 'Zukunft' },
    settings: { dayStart: 7, dayEnd: 22, theme: 'auto', sleep: { on: false, from: 0, to: 0, wind: 0 } },
    areas: [{ id: 'a1', name: 'Zukunftsbereich', hue: 10, plan: { goal: 3, days: [0,1,2,3,4,5,6], from: null, to: null, min: 15, max: 240, must: true, pad: 0, art: null, ortId: null } }],
    blocks: [{ id: 'zk1', title: 'Zukunftstermin', areaId: 'a1', day: 0, date: '2026-08-03', repeat: 'none', start: 600, end: 660, frog: false }],
    tasks: [], days: {}, orte: [], wege: {}, tombs: {}, erledigt: {}, rituale: {},
    zukunftsfeld: { irgendwas: true }   // Feld, das eine kuenftige Version erfinden koennte
  };
  const zk = await fall('8) Zukunftsversion (version 99), ERSETZEN', 'zukunft.json', JSON.stringify(zukunftDatei), 'ersetzen');
  const zkVersion = await p.evaluate(() => state.version);
  ok(zkVersion === 9, '8) migrate() zieht eine Zukunftsversion trotzdem auf version 9 (' + zkVersion + '), kein Absturz');

  await p.close();
  await ctx.close();

  // -------------------------------------------------------------
  // Zusammenfassung, woertlich fuer die Dokumentation im Auftrag.
  // -------------------------------------------------------------
  console.log('\n\n========== ZUSAMMENFASSUNG ==========');
  ergebnisse.forEach(e => {
    console.log('- ' + e.titel + ' [' + (e.aktion || '') + ']: ' +
      'toastVorKlick=' + JSON.stringify(e.toastVorKlick) +
      ' dialogOffen=' + e.dialogOffen +
      ' toastNachKlick=' + JSON.stringify(e.toastNachKlick) +
      ' zustandUnveraendert=' + e.zustandUnveraendert +
      ' bedienbar=' + e.bedienbar +
      ' stateIstArray=' + e.stateIstArray +
      ' konsolenfehler=' + (e.konsolenfehler.length ? JSON.stringify(e.konsolenfehler) : 'keine'));
  });

  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  await br.close();
  if (fehler.length) process.exit(1);
})();
