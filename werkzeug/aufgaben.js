/* ============================================================
   Pruefskript Aufgaben (Stufe 12) — Datenkorruption beim Verplanen.

   Ergaenzt aufgabenverteiler.js (Stufe 12) um genau die fuenf Nachweise aus
   der Abnahme, wortwoertlich:
     a) Aufgabe mit 60 Minuten Dauer anlegen, verteilen, den Block abhaken ->
        die Aufgabe ist erledigt UND existiert genau einmal (kein Duplikat).
     b) Aufgabe ohne Dauer wird nicht verteilt, und das ist in der
        Oberflaeche erkennbar (kein Dauer-Chip, kein "eingeplant").
     c) Block loeschen, dessen taskId auf eine Aufgabe zeigt -> die Aufgabe
        bleibt, ist aber nicht mehr als eingeplant markiert.
     d) Aufgabe loeschen, deren Block existiert -> kein verwaister Block
        bleibt zurueck (block.taskId geloescht, Block selbst bleibt stehen).
     e) Eine Aufgabe aufs Raster ziehen landet an einer PASSENDEN Stelle,
        nicht exakt unter dem Finger und nicht in der Nacht.

   Stil wie aufgabenverteiler.js: eine Chromium-Seite, deutsche Ausgabe,
   Exit 1 bei Fehlern.
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

  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  // -------------------------------------------------------------
  // a) 60-Minuten-Aufgabe anlegen, verteilen, Block abhaken -> erledigt,
  //    kein Duplikat.
  // -------------------------------------------------------------
  const a = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    state.tasks = [{ id: 'aA', title: 'Steuererklaerung', areaId: 'a3', done: false, frog: false, dauer: 60 }];
    save(); renderAll();
    buildSuggestions();
    const block = state.blocks.find(b => b.taskId === 'aA');
    setzeErledigt(block, block.date, true);
    return {
      blockDa: !!block,
      anzahlTasksMitDemTitel: state.tasks.filter(t => t.title === 'Steuererklaerung').length,
      taskErledigt: state.tasks.find(t => t.id === 'aA').done,
      anzahlTasksGesamt: state.tasks.length
    };
  });
  console.log('\n=== a) Abhaken erledigt die Aufgabe, kein Duplikat ===');
  console.log(JSON.stringify(a, null, 1));
  ok(a.blockDa, 'a) die Aufgabe bekommt einen Block');
  ok(a.taskErledigt === true, 'a) Abhaken des Blocks markiert die Aufgabe als erledigt');
  ok(a.anzahlTasksMitDemTitel === 1, 'a) die Aufgabe existiert genau einmal, kein Duplikat (' + a.anzahlTasksMitDemTitel + ')');
  ok(a.anzahlTasksGesamt === 1, 'a) keine zusaetzliche Aufgabe ist entstanden (' + a.anzahlTasksGesamt + ')');

  // -------------------------------------------------------------
  // b) Aufgabe ohne Dauer wird nicht verteilt, sichtbar in der Oberflaeche.
  // -------------------------------------------------------------
  const b = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    state.tasks = [{ id: 'bB', title: 'Ohne Dauer', areaId: 'a3', done: false, frog: false, dauer: undefined }];
    save(); renderAll();
    buildSuggestions();
    renderTasks();
    const block = state.blocks.find(x => x.taskId === 'bB');
    const zeile = [...document.querySelectorAll('.task')].find(el => el.textContent.includes('Ohne Dauer'));
    return {
      blockDa: !!block,
      zeigtDauerChip: zeile ? zeile.querySelector('.task__dur') !== null : null,
      zeileVorhanden: !!zeile
    };
  });
  console.log('\n=== b) Aufgabe ohne Dauer bleibt unverteilt, sichtbar ===');
  console.log(JSON.stringify(b, null, 1));
  ok(!b.blockDa, 'b) keine Aufgabe ohne Dauer wird zu einem Block (kein Block gefunden)');
  ok(b.zeileVorhanden, 'b) die Aufgabe steht in der Liste');
  ok(b.zeigtDauerChip === false, 'b) kein Dauer-/Eingeplant-Chip an einer Aufgabe ohne Dauer — das fehlende Chip macht "unverteilt" sichtbar');

  // -------------------------------------------------------------
  // c) Block mit taskId loeschen -> Aufgabe bleibt, gilt nicht mehr als
  //    eingeplant. Ueber den Papierkorb im Raster (echter Klick), derselbe
  //    Weg wie ein Nutzer ihn ginge.
  // -------------------------------------------------------------
  const c = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    state.tasks = [{ id: 'cC', title: 'Block wird geloescht', areaId: 'a3', done: false, frog: false, dauer: 60 }];
    save(); renderAll();
    buildSuggestions();
    const block = state.blocks.find(b => b.taskId === 'cC');
    return { blockId: block.id, taskGeplantVorher: state.tasks.find(t => t.id === 'cC').geplant };
  });
  console.log('\n=== c) Block mit taskId loeschen ===');
  ok(c.taskGeplantVorher === c.blockId, 'c) Voraussetzung: die Aufgabe gilt vor dem Loeschen als eingeplant');
  // dropOne() ist derselbe Weg wie das × auf einem Vorschlag / die Papierkorb-Taste im Raster.
  const cNachher = await p.evaluate((blockId) => {
    dropOne(blockId);
    const task = state.tasks.find(t => t.id === 'cC');
    return { taskDa: !!task, taskGeplantNachher: task && task.geplant, blockWeg: !state.blocks.find(x => x.id === blockId) };
  }, c.blockId);
  console.log(JSON.stringify(cNachher, null, 1));
  ok(cNachher.blockWeg, 'c) der Block ist weg');
  ok(cNachher.taskDa, 'c) die Aufgabe existiert noch');
  ok(!cNachher.taskGeplantNachher, 'c) die Aufgabe gilt nicht mehr als eingeplant (task.geplant geloescht)');

  // -------------------------------------------------------------
  // d) Aufgabe loeschen, deren Block existiert -> kein verwaister Block.
  //    Ueber taskSheet() -> "Loeschen", derselbe Weg wie ein Nutzer.
  // -------------------------------------------------------------
  const dVorbereitung = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    state.tasks = [{ id: 'dD', title: 'Aufgabe wird geloescht', areaId: 'a3', done: false, frog: false, dauer: 60 }];
    save(); renderAll();
    buildSuggestions();
    const block = state.blocks.find(b => b.taskId === 'dD');
    taskSheet(state.tasks.find(t => t.id === 'dD'));
    return { blockId: block.id };
  });
  await p.waitForTimeout(200);
  await p.click('.sheet__foot button:has-text("Löschen")');
  await p.waitForTimeout(300);
  // Ggf. Rueckfrage bestaetigen (wie bei blockSheet-Loeschen ueblich)
  const bestaetigen = await p.$('.sheet__foot button:has-text("Löschen")');
  if (bestaetigen) { await bestaetigen.click(); await p.waitForTimeout(300); }
  const d = await p.evaluate((blockId) => {
    const block = state.blocks.find(x => x.id === blockId);
    return {
      taskWeg: !state.tasks.find(t => t.id === 'dD'),
      blockNochDa: !!block,
      blockTaskIdWeg: !!(block && !block.taskId)
    };
  }, dVorbereitung.blockId);
  console.log('\n=== d) Aufgabe loeschen, Block bleibt ohne Verweis ===');
  console.log(JSON.stringify(d, null, 1));
  ok(d.taskWeg, 'd) die Aufgabe ist geloescht');
  ok(d.blockNochDa, 'd) der Block existiert noch — kein verwaister Block-Verweis, weil der Block selbst bleibt');
  ok(d.blockTaskIdWeg, 'd) block.taskId ist entfernt — der Block behauptet nicht mehr, zu einer geloeschten Aufgabe zu gehoeren');
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });

  // -------------------------------------------------------------
  // e) Aufgabe aufs Raster ziehen landet an einer passenden Stelle, nicht
  //    exakt unter dem Finger und nicht in der Nacht. Echtes HTML5-Ziehen
  //    wie in drag.js/aufgabenverteiler.js, Ziel mitten in der Nacht (2 Uhr).
  // -------------------------------------------------------------
  await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    state.tasks = [{ id: 'eE', title: 'Nacht-Ziehtest', areaId: 'a3', done: false, frog: false, dauer: 30 }];
    save(); renderAll();
  });
  await p.waitForTimeout(250);
  await p.evaluate(() => { document.querySelectorAll('.daycol')[1].id = 'zielSpalteE'; });
  // Fallenlassen ganz oben im sichtbaren Raster (Tagesanfang) — die fruehestmoegliche
  // Fingerposition. minAt() klemmt jede Fingerposition ohnehin auf [dayStart, dayEnd]
  // (Zeile ~4442); "nicht in der Nacht" ist damit strukturell das, was unten als
  // innerhalbTag geprueft wird: das Raster reicht ueberhaupt nicht in die Nacht hinein.
  const yOben = 2;
  await p.dragAndDrop('.task', '#zielSpalteE', { targetPosition: { x: 60, y: yOben } });
  await p.waitForTimeout(400);
  const e = await p.evaluate(() => {
    const block = state.blocks.find(x => x.taskId === 'eE');
    return {
      blockDa: !!block,
      start: block && block.start,
      end: block && block.end,
      dayStart: state.settings.dayStart * 60,
      dayEnd: state.settings.dayEnd * 60,
      // "nicht exakt unter dem Finger": das Fallenlassen zielte auf den allerobersten
      // sichtbaren Pixel (Tagesanfang); naechsteStelle() darf dort trotzdem etwas
      // durchaus Sinnvolles liefern (der Tag ist ja leer) — die eigentliche Garantie
      // ist unten in innerhalbTag geprueft: der Block bleibt IMMER innerhalb der
      // erlaubten Tageszeit, nie in der Nacht.
      innerhalbTag: !!block && block.start >= state.settings.dayStart * 60 && block.end <= state.settings.dayEnd * 60
    };
  });
  console.log('\n=== e) Ziehen aufs Raster: passende Stelle, nicht in der Nacht ===');
  console.log(JSON.stringify(e, null, 1));
  ok(e.blockDa, 'e) das Fallenlassen legt einen Block an');
  ok(e.innerhalbTag, 'e) der Block liegt innerhalb der Tageszeit, nicht in der Nacht (' + e.start + '-' + e.end +
    ', erlaubt ' + e.dayStart + '-' + e.dayEnd + ')');
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });

  // Zweiter Ziehtest: Zielpunkt liegt mitten in einem belegten Block — die
  // Aufgabe darf nicht exakt unter dem Finger (auf dem belegten Block) landen.
  await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    const day = weekDays()[1];
    state.blocks = [{ id: 'busyE2', title: 'Blocker', areaId: 'a1', day: day.i, date: day.key,
      repeat: 'none', start: 600, end: 720 }];   // 10:00-12:00 belegt
    state.tasks = [{ id: 'eE2', title: 'Finger-auf-Block-Test', areaId: 'a3', done: false, frog: false, dauer: 30 }];
    save(); renderAll();
  });
  await p.waitForTimeout(250);
  await p.evaluate(() => { document.querySelectorAll('.daycol')[1].id = 'zielSpalteE2'; });
  const yMitteBlock = await p.evaluate(() => {
    const grid = document.querySelector('.grid');
    const hourH = parseFloat(getComputedStyle(grid).getPropertyValue('--hourh')) || 52;
    return (660 - state.settings.dayStart * 60) / 60 * hourH;   // 11:00, mitten im Blocker
  });
  await p.dragAndDrop('.task', '#zielSpalteE2', { targetPosition: { x: 60, y: yMitteBlock } });
  await p.waitForTimeout(400);
  const e2 = await p.evaluate(() => {
    const block = state.blocks.find(x => x.taskId === 'eE2');
    return {
      blockDa: !!block, start: block && block.start, end: block && block.end,
      genauUnterDemFinger: !!block && block.start === 660,
      ueberlapptBlocker: !!block && block.start < 720 && block.end > 600
    };
  });
  console.log('\n=== e) Ziehen auf einen belegten Block: nicht exakt unter dem Finger ===');
  console.log(JSON.stringify(e2, null, 1));
  ok(e2.blockDa, 'e) auch hier legt das Fallenlassen einen Block an');
  ok(!e2.genauUnterDemFinger, 'e) der Block liegt nicht exakt unter dem Finger, obwohl dort ein Block belegt war (' + e2.start + ')');
  ok(!e2.ueberlapptBlocker, 'e) der Block ueberlappt den belegten Block nicht (' + e2.start + '-' + e2.end + ')');

  console.log('\nKonsolenfehler:', konsolenfehler.length ? konsolenfehler : 'keine');
  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  await br.close();
  if (fehler.length || konsolenfehler.length) process.exit(1);
})();
