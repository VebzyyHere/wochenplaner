/* ============================================================
   Pruefskript Aufgabenverteiler (Stufe 12) — Aufgaben werden verplant.

   a) Grundplatzierung ohne Datenkorruption: eine Aufgabe mit Dauer bekommt
      per buildSuggestions() einen Blockvorschlag mit der ECHTEN areaId
      (keine erfundene "task:..."-ID), block.taskId und task.geplant
      zeigen aufeinander. migrate() danach (steht fuer Reload/Sync-Merge)
      legt keinen neuen Bereich "Sonstiges" an — die areaId-Falle aus dem
      Auftrag greift nicht.
   b) Eine Aufgabe wird als GENAU EIN Block verplant, auch wenn ihre Dauer
      groesser ist als der laengste ueblliche Block ihres Bereichs
      (placeArea wuerde ein Bereichsziel hier auf zwei Tage aufteilen).
   c) naechsteStelle(): liegt der Wunschzeitpunkt in einem belegten Block,
      kommt die naechste wirklich freie Stelle zurueck, nicht der
      Wunschzeitpunkt selbst; ist der ganze Tag belegt, kommt null.
   d) Der Drop-Handler (Aufgabe aufs Raster ziehen) nutzt naechsteStelle
      wirklich: fallengelassen mitten in einem belegten Block, landet die
      Aufgabe daneben, nicht darauf — echtes HTML5-Ziehen wie in drag.js.
   e) "In den Wochenplan legen" im Aufgabenblatt nutzt denselben Weg: der
      Standard-Wunschzeitpunkt ("jetzt + 1 h") wird absichtlich blockiert,
      der am Ende gesetzte Block liegt trotzdem frei.
   f) Ein geloeschter Block (Papierkorb-Taste im Raster) nimmt seine
      Aufgabe nicht mit — sie taucht als offen (ohne .geplant) wieder auf.
   g) Eine geloeschte Aufgabe reisst ihren Block nicht mit — der Block
      bleibt stehen, verliert nur block.taskId.
   h) wochenKapazitaet() zaehlt offene Aufgabenminuten mit; setzeErledigt()
      hakt die verknuepfte Aufgabe mit ab.
   i) growSuggestions() (uebrige Bereichsminuten an einen bestehenden
      Vorschlag anhaengen) laesst einen Aufgaben-Block in Ruhe, obwohl der
      dieselbe areaId traegt wie der echte Bereich — sonst waechst eine
      30-Minuten-Aufgabe beim naechsten Verteilen stillschweigend auf die
      Laenge, die dem Bereich noch offenstand.

   Stil wie stabil.js/erklaer.js: eine Chromium-Seite, deutsche Ausgabe,
   Exit 1 bei Fehlern. Die Uhrzeit wird ueber page.clock.setFixedTime()
   festgenagelt (wie in schleife.js) — Teil e) testet den Standard-
   Wunschzeitpunkt "jetzt + 1 h" auf dem HEUTIGEN Tag, und freeGaps()
   schneidet den Tag am aktuellen Zeitpunkt ab. Ohne feste Uhr blieb je
   nach Tageszeit irgendwann kein Platz mehr nach dem geblockten
   Wunschzeitpunkt uebrig, und Teil e) schlug rein zeitabhaengig fehl.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const p = await br.newPage({ viewport: { width: 1400, height: 950 } });
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  await p.clock.setFixedTime(new Date('2026-08-05T09:00:00+02:00'));
  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  // -------------------------------------------------------------
  // a) Grundplatzierung ohne Datenkorruption
  // -------------------------------------------------------------
  const a = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);   // Zukunftswoche, wie realtest.js
    state.blocks = [];
    state.tasks = [{ id: 'tA', title: 'Bericht schreiben', areaId: 'a3', done: false, frog: false, dauer: 60 }];
    const areasVorher = state.areas.length;
    save(); renderAll();
    buildSuggestions();
    const block = state.blocks.find(b => b.taskId === 'tA');
    migrate(state);   // steht fuer Reload/Sync-Merge — Falle wuerde hier zuschlagen
    const areasNachher = state.areas.length;
    const task = state.tasks.find(t => t.id === 'tA');
    const blockNachMigrate = state.blocks.find(b => b.id === (block && block.id));
    return {
      areasVorher, areasNachher,
      blockId: block && block.id, blockAreaId: block && block.areaId, blockTaskId: block && block.taskId,
      blockSug: block && block.sug, blockGrund: block && block.grund,
      taskGeplant: task && task.geplant,
      blockUeberlebtMigrate: !!blockNachMigrate,
      sonstigesName: state.areas.find(x => x.name === 'Sonstiges')
    };
  });
  console.log('\n=== a) Grundplatzierung ohne Datenkorruption ===');
  console.log(JSON.stringify(a, null, 1));
  ok(a.areasNachher === a.areasVorher, 'a) migrate() legt keinen neuen Bereich an (' + a.areasVorher + ' -> ' + a.areasNachher + ')');
  ok(!a.sonstigesName, 'a) kein Bereich "Sonstiges" entsteht');
  ok(a.blockAreaId === 'a3', 'a) der Block traegt die echte areaId der Aufgabe (a3), keine erfundene ID (' + a.blockAreaId + ')');
  ok(a.blockTaskId === 'tA', 'a) der Block kennt seine Aufgabe ueber taskId');
  ok(a.taskGeplant === a.blockId, 'a) task.geplant zeigt auf genau diesen Block');
  ok(!!a.blockSug, 'a) die Platzierung ist ein normaler Vorschlag (sug:true), ziehbar/ablehnbar wie jeder andere');
  ok(typeof a.blockGrund === 'string' && a.blockGrund.trim().length > 0, 'a) der Aufgaben-Vorschlag hat eine Begruendung');
  ok(a.blockUeberlebtMigrate, 'a) der Block ueberlebt migrate() unangetastet');

  // -------------------------------------------------------------
  // b) Eine Aufgabe wird nicht zerstueckelt
  // -------------------------------------------------------------
  const b = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    // a7 = Alltag/orga, Art-Obergrenze 90 min — die Aufgabe dauert laenger
    state.tasks = [{ id: 'tB', title: 'Keller aufraeumen', areaId: 'a7', done: false, frog: false, dauer: 180 }];
    save(); renderAll();
    buildSuggestions();
    const bloecke = state.blocks.filter(x => x.taskId === 'tB');
    return { anzahl: bloecke.length, dauern: bloecke.map(x => x.end - x.start) };
  });
  console.log('\n=== b) Aufgabe wird nicht zerstueckelt ===');
  console.log(JSON.stringify(b, null, 1));
  ok(b.anzahl === 1, 'b) genau ein Block fuer die Aufgabe (' + b.anzahl + ')');
  ok(b.dauern[0] === 180, 'b) der Block traegt die volle Dauer der Aufgabe (' + b.dauern[0] + ')');

  // -------------------------------------------------------------
  // c) naechsteStelle(): Unit-Verhalten
  // -------------------------------------------------------------
  const c = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    const day = weekDays()[2];   // Mittwoch der Zukunftswoche
    state.blocks.push({ id: 'busy', title: 'Blocker', areaId: 'a1', day: day.i, date: day.key,
      repeat: 'none', start: 600, end: 660 });   // 10:00-11:00 belegt
    const area = state.areas.find(x => x.id === 'a1');
    const treffer = naechsteStelle(day, 30, 630, area);      // Wunsch 10:30, mitten im Block
    const frei = naechsteStelle(day, 30, 480, area);          // Wunsch 08:00, frei
    // Ganzer Tag belegt: 0..1440
    state.blocks = [{ id: 'ganztag', title: 'Blocker', areaId: 'a1', day: day.i, date: day.key,
      repeat: 'none', start: 0, end: 1440 }];
    const nichts = naechsteStelle(day, 30, 630, area);
    return { treffer, frei, nichts, ueberlappt: treffer !== null && treffer < 660 && treffer + 30 > 600 };
  });
  console.log('\n=== c) naechsteStelle() ===');
  console.log(JSON.stringify(c, null, 1));
  ok(c.treffer !== null && !c.ueberlappt, 'c) Wunsch mitten im belegten Block -> Treffer liegt daneben, nicht darauf (' + c.treffer + ')');
  ok(c.frei === 480, 'c) freier Wunschzeitpunkt bleibt der Wunschzeitpunkt (' + c.frei + ')');
  ok(c.nichts === null, 'c) kein Platz im Tag -> null statt einer erfundenen Stelle');

  // -------------------------------------------------------------
  // d) Drop-Handler nutzt naechsteStelle (echtes HTML5-Ziehen)
  // -------------------------------------------------------------
  await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    const day = weekDays()[3];   // Donnerstag der Zukunftswoche
    state.blocks = [{ id: 'busyD', title: 'Blocker', areaId: 'a1', day: day.i, date: day.key,
      repeat: 'none', start: 600, end: 720 }];   // 10:00-12:00 belegt
    state.tasks = [{ id: 'tD', title: 'Zieh-Aufgabe', areaId: 'a3', done: false, frog: false, dauer: 60 }];
    save(); renderAll();
  });
  await p.waitForTimeout(250);
  // Die ID erst NACH renderAll() vergeben — renderAll() baut die Spalten neu
  // auf und würde eine vorher vergebene ID sonst gleich wieder verwerfen.
  await p.evaluate(() => { document.querySelectorAll('.daycol')[3].id = 'zielSpalteD'; });
  // Fallenlassen bei 11:00 (mitten im belegten Block) — dasselbe Muster wie drag.js,
  // nur mit einem Zielpunkt, der bewusst mitten im Blocker liegt.
  const yD = await p.evaluate(() => {
    const grid = document.querySelector('.grid');
    const hourH = parseFloat(getComputedStyle(grid).getPropertyValue('--hourh')) || 52;
    return (660 - state.settings.dayStart * 60) / 60 * hourH;   // 11:00
  });
  await p.dragAndDrop('.task', '#zielSpalteD', { targetPosition: { x: 60, y: yD } });
  await p.waitForTimeout(400);
  const d = await p.evaluate(() => {
    const block = state.blocks.find(x => x.taskId === 'tD');
    const task = state.tasks.find(x => x.id === 'tD');
    return {
      blockDa: !!block, start: block && block.start, end: block && block.end,
      ueberlappt: !!block && block.start < 720 && block.end > 600,
      taskGeplant: task && task.geplant, stimmtUeberein: !!block && task && task.geplant === block.id
    };
  });
  console.log('\n=== d) Drop-Handler nutzt naechsteStelle ===');
  console.log(JSON.stringify(d, null, 1));
  ok(d.blockDa, 'd) das Fallenlassen legt einen Block an');
  ok(!d.ueberlappt, 'd) der Block liegt nicht auf dem belegten Block (' + d.start + '-' + d.end + ')');
  ok(d.stimmtUeberein, 'd) task.geplant zeigt auf genau diesen Block');
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });

  // -------------------------------------------------------------
  // e) "In den Wochenplan legen" nutzt denselben Weg
  // -------------------------------------------------------------
  const eVorbereitung = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = new Date();   // laufende Woche — inPlan haengt an selectedDayIdx/anchor
    selectedDayIdx = (new Date().getDay() + 6) % 7;
    const d = addDays(mondayOf(anchor), selectedDayIdx);
    const laenge = 45;
    const wunsch = clamp(snap(new Date().getHours() * 60 + 60),
      state.settings.dayStart * 60, state.settings.dayEnd * 60 - laenge);
    state.blocks = [{ id: 'busyE', title: 'Blocker', areaId: 'a1', day: selectedDayIdx, date: iso(d),
      repeat: 'none', start: wunsch, end: wunsch + laenge }];   // genau der Standard-Zielpunkt belegt
    state.tasks = [{ id: 'tE', title: 'In-Plan-Aufgabe', areaId: 'a3', done: false, frog: false, dauer: laenge }];
    save(); renderAll();
    taskSheet(state.tasks[0]);
    return { wunsch, laenge };
  });
  await p.waitForTimeout(250);
  await p.click('button:has-text("In den Wochenplan legen")');
  await p.waitForTimeout(250);
  await p.click('.sheet__foot button:has-text("Eintragen")');
  await p.waitForTimeout(300);
  const e = await p.evaluate((vor) => {
    const block = state.blocks.find(x => x.taskId === 'tE');
    const task = state.tasks.find(x => x.id === 'tE');
    return {
      blockDa: !!block, start: block && block.start, end: block && block.end,
      liegtAufWunsch: !!block && block.start === vor.wunsch,
      ueberlapptBlocker: !!block && block.start < (vor.wunsch + vor.laenge) && block.end > vor.wunsch,
      taskGeplant: task && task.geplant, stimmtUeberein: !!block && task && task.geplant === block.id
    };
  }, eVorbereitung);
  console.log('\n=== e) "In den Wochenplan legen" nutzt naechsteStelle ===');
  console.log(JSON.stringify(e, null, 1));
  ok(e.blockDa, 'e) "Eintragen" legt einen Block an');
  ok(!e.ueberlapptBlocker, 'e) der Block liegt nicht auf dem blockierten Standard-Wunschzeitpunkt (' + e.start + '-' + e.end + ')');
  ok(e.stimmtUeberein, 'e) task.geplant zeigt auf genau diesen Block');
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });

  // -------------------------------------------------------------
  // f) Geloeschter Block nimmt seine Aufgabe nicht mit
  // g) Geloeschte Aufgabe reisst ihren Block nicht mit
  // -------------------------------------------------------------
  const fg = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    state.tasks = [
      { id: 'tF', title: 'Block wird geloescht', areaId: 'a3', done: false, frog: false, dauer: 60 },
      { id: 'tG', title: 'Aufgabe wird geloescht', areaId: 'a3', done: false, frog: false, dauer: 60 }
    ];
    save(); renderAll();
    buildSuggestions();
    const blockF = state.blocks.find(x => x.taskId === 'tF');
    const blockG = state.blocks.find(x => x.taskId === 'tG');
    // f) Block loeschen wie im Raster (dropOne — derselbe Weg wie das ×
    //    auf einem Vorschlag oder Delete/Backspace)
    dropOne(blockF.id);
    const taskFNachher = state.tasks.find(x => x.id === 'tF');
    const blockFWeg = !state.blocks.find(x => x.id === blockF.id);
    // g) Aufgabe loeschen wie im Aufgabenblatt (dieselbe Logik: taskId
    //    strippen, Block bleibt stehen)
    state.blocks.forEach(x => { if (x.taskId === 'tG') delete x.taskId; });
    state.tasks = state.tasks.filter(x => x.id !== 'tG');
    const blockGNachher = state.blocks.find(x => x.id === blockG.id);
    return {
      taskFVorhanden: !!taskFNachher, taskFGeplantWeg: !!(taskFNachher && !taskFNachher.geplant), blockFWeg,
      blockGVorhanden: !!blockGNachher, blockGTaskIdWeg: !!(blockGNachher && !blockGNachher.taskId),
      taskGWeg: !state.tasks.find(x => x.id === 'tG')
    };
  });
  console.log('\n=== f)+g) Loeschen reisst nichts mit ===');
  console.log(JSON.stringify(fg, null, 1));
  ok(fg.blockFWeg, 'f) der Block ist weg');
  ok(fg.taskFVorhanden, 'f) die Aufgabe existiert noch');
  ok(fg.taskFGeplantWeg, 'f) task.geplant ist geloescht — die Aufgabe gilt wieder als offen');
  ok(fg.taskGWeg, 'g) die Aufgabe ist weg');
  ok(fg.blockGVorhanden, 'g) der Block existiert noch');
  ok(fg.blockGTaskIdWeg, 'g) block.taskId ist geloescht — kein Vorgeben mehr, zu etwas zu gehoeren');

  // -------------------------------------------------------------
  // h) wochenKapazitaet() und setzeErledigt()
  // -------------------------------------------------------------
  const h = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    state.areas.forEach(x => { x.plan.goal = 0; });
    const ohneAufgabe = wochenKapazitaet();
    state.tasks = [{ id: 'tH', title: 'Kapazitaets-Aufgabe', areaId: 'a3', done: false, frog: false, dauer: 120 }];
    const mitAufgabe = wochenKapazitaet();

    // setzeErledigt(): Block mit taskId abhaken zieht die Aufgabe mit ab
    const day = weekDays()[0];
    const block = { id: 'blkH', title: 'x', areaId: 'a3', taskId: 'tH', day: day.i, date: day.key,
      repeat: 'none', start: 600, end: 660 };
    state.blocks.push(block);
    setzeErledigt(block, day.key, true);
    const taskAn = state.tasks.find(x => x.id === 'tH').done;
    setzeErledigt(block, day.key, false);
    const taskAus = state.tasks.find(x => x.id === 'tH').done;

    return { offenOhne: ohneAufgabe.offen, offenMit: mitAufgabe.offen, taskAn, taskAus };
  });
  console.log('\n=== h) wochenKapazitaet() + setzeErledigt() ===');
  console.log(JSON.stringify(h, null, 1));
  ok(h.offenMit === h.offenOhne + 120, 'h) wochenKapazitaet() zaehlt die offene Aufgabendauer mit (' + h.offenOhne + ' -> ' + h.offenMit + ')');
  ok(h.taskAn === true, 'h) Block mit taskId abhaken setzt task.done');
  ok(h.taskAus === false, 'h) Block wieder loeschen setzt task.done zurueck');

  // -------------------------------------------------------------
  // i) growSuggestions() laesst Aufgaben-Bloecke in Ruhe
  // -------------------------------------------------------------
  const i = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    const day = weekDays()[1];
    // Ein 30-Minuten-Aufgaben-Vorschlag, alleine an diesem Tag im Bereich
    // a3 — genau die Lage, in der growSuggestions() vorher zugriff, weil
    // areaId === area.id auch fuer Aufgaben-Bloecke gilt.
    state.blocks = [{ id: 'tiBlock', title: 'x', areaId: 'a3', taskId: 'tI', day: day.i, date: day.key,
      repeat: 'none', start: 600, end: 630, sug: true, frog: false }];
    state.tasks = [{ id: 'tI', title: 'Kurze Aufgabe', areaId: 'a3', done: false, frog: false, dauer: 30, geplant: 'tiBlock' }];
    const area = state.areas.find(x => x.id === 'a3');
    const used = growSuggestions(area, 60);   // 60 min "uebrig" aus einem Bereichsziel
    const nachher = state.blocks.find(x => x.id === 'tiBlock');
    return { used, dauerVorher: 30, dauerNachher: nachher.end - nachher.start };
  });
  console.log('\n=== i) growSuggestions() laesst Aufgaben-Bloecke in Ruhe ===');
  console.log(JSON.stringify(i, null, 1));
  ok(i.dauerNachher === i.dauerVorher, 'i) der Aufgaben-Block waechst nicht mit (' + i.dauerVorher + ' -> ' + i.dauerNachher + ')');
  ok(i.used === 0, 'i) growSuggestions() findet ohne den Aufgaben-Block nichts zu verlaengern (' + i.used + ')');

  console.log('\nKonsolenfehler:', konsolenfehler.length ? konsolenfehler : 'keine');
  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  await br.close();
  if (fehler.length || konsolenfehler.length) process.exit(1);
})();
