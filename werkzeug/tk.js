const { chromium, devices } = require('playwright');
const path = require('path');

// Stufe 14: der Aufgaben-Bildschirm ist jetzt eine Gliederung ("Heute
// zählt" / "Ohne Platz" / "Eingeplant" / "Erledigt"), keine flache Liste
// mehr. fehler/ok() folgt demselben Muster wie haken.js, agenda.js und
// aufgabenverteiler.js — die alten Schritte unten (2-6) bleiben reine
// Beobachtung wie zuvor, die neuen Schritte prüfen die Gliederung selbst.
const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone SE'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(450);
  await p.evaluate(() => closeModal());

  // Vier Aufgaben statt zwei: eine ohne Dauer (Hausarbeit), eine mit Dauer
  // (Einkaufen, damit die Sortierung "Dauer vor ohne Dauer" etwas zu prüfen
  // hat), eine mit Stern (Zeugnis abholen, für "Heute zählt") und eine
  // bereits erledigte (Blumen gießen, für den zusammengeklappten Abschnitt).
  await p.evaluate(() => {
    state.tasks.push({id:'t1',title:'Hausarbeit',areaId:'a2',done:false,frog:false});
    state.tasks.push({id:'t2',title:'Einkaufen',areaId:'a7',dauer:30,done:false,frog:false});
    state.tasks.push({id:'t3',title:'Zeugnis abholen',areaId:'a1',done:false,frog:true});
    state.tasks.push({id:'t4',title:'Blumen gießen',areaId:'a3',done:true,frog:false});
    save(); renderAll(); setView('aufgaben');
  });
  await p.waitForTimeout(300);

  const zeile = await p.evaluate(() => {
    const r = document.querySelector('.task');
    return { hoehe: Math.round(r.getBoundingClientRect().height),
             knoepfe: [...r.querySelectorAll('button')].map(b=>b.className+' '+Math.round(b.getBoundingClientRect().width)+'x'+Math.round(b.getBoundingClientRect().height)),
             meta: r.querySelector('.task__meta').textContent };
  });
  console.log('1) Zeile:', JSON.stringify(zeile));

  // ---- Gliederung im Grundzustand: nichts eingeplant, ein Stern, ein
  // erledigter Eintrag ----
  const gliederung1 = await p.evaluate(() => ({
    labels: [...document.querySelectorAll('#taskList .agenda__label')].map(e => e.textContent.trim()),
    frog: document.querySelector('.agenda__frog') ? document.querySelector('.agenda__frog').textContent : null,
    ohnePlatz: (() => {
      const kopf = [...document.querySelectorAll('#taskList .agenda__label')].find(e => e.textContent === 'Ohne Platz');
      const titel = [];
      let n = kopf ? kopf.nextElementSibling : null;
      while (n && n.classList.contains('task')) { titel.push(n.querySelector('.task__title').textContent.trim()); n = n.nextElementSibling; }
      return titel;
    })(),
    erledigtAufgeklappt: document.querySelector('.tasks__toggle') ? document.querySelector('.tasks__toggle').getAttribute('aria-expanded') : null,
    erledigtSichtbar: document.querySelectorAll('.task.is-done').length,
    wegKnopf: !!document.querySelector('.tasks__toggle ~ .btn--ghost'),
    foot: document.getElementById('tasksFoot').hidden ? null : document.getElementById('tasksFoot').textContent
  }));
  console.log('2) Gliederung (nichts eingeplant):', JSON.stringify(gliederung1));
  // Der Erledigt-Kopf trägt zusätzlich den Auf/Zu-Pfeil im textContent
  // (zwei <span>, ohne Leerzeichen dazwischen) — deshalb hier ohne Pfeil
  // vergleichen statt den genauen Pfeil mitzuführen.
  ok(JSON.stringify(gliederung1.labels.map(l => l.replace(/[⌄⌃]$/, ''))) === JSON.stringify(['Heute zählt','Ohne Platz','Erledigt (1)']),
     'Reihenfolge ohne Eingeplant: ' + gliederung1.labels.join(' / '));
  ok(gliederung1.frog === 'Zeugnis abholen', 'Tagesschwerpunkt oben: ' + gliederung1.frog);
  ok(JSON.stringify(gliederung1.ohnePlatz) === JSON.stringify(['Einkaufen','Hausarbeit','Zeugnis abholen']),
     'Sortierung Ohne Platz (Dauer vor ohne Dauer, dann alphabetisch): ' + gliederung1.ohnePlatz.join(', '));
  ok(gliederung1.erledigtAufgeklappt === 'false' && gliederung1.erledigtSichtbar === 0 && !gliederung1.wegKnopf,
     'Erledigt startet zusammengeklappt, ohne "Erledigte weg"');
  ok(gliederung1.foot === '0 von 3 Aufgaben haben einen Platz diese Woche.', 'Fusszeile "X von Y": ' + gliederung1.foot);

  // ---- Erledigt aufklappen und wieder zuklappen ----
  await p.click('.tasks__toggle'); await p.waitForTimeout(250);
  const auf = await p.evaluate(() => ({
    expanded: document.querySelector('.tasks__toggle').getAttribute('aria-expanded'),
    zeilen: [...document.querySelectorAll('.task.is-done')].map(r => r.querySelector('.task__title').textContent.trim()),
    wegKnopf: !!document.querySelector('.tasks__toggle ~ .btn--ghost')
  }));
  console.log('3) Erledigt aufgeklappt:', JSON.stringify(auf));
  ok(auf.expanded === 'true' && JSON.stringify(auf.zeilen) === JSON.stringify(['Blumen gießen']) && auf.wegKnopf,
     'Erledigt zeigt die erledigte Aufgabe samt "Erledigte weg"');
  await p.click('.tasks__toggle'); await p.waitForTimeout(250);

  // ---- .task__go plant "Einkaufen" direkt aus der Zeile heraus, nimmt die
  // hinterlegte Dauer und lässt den Abschnitt "Eingeplant" entstehen ----
  await p.click('.task:has-text("Einkaufen") .task__go'); await p.waitForTimeout(350);
  const goSheet = await p.evaluate(() => {
    const s = document.querySelector('.sheet');
    return { titel: s.querySelector('#bTitle').value, von: s.querySelector('#bFrom').value, bis: s.querySelector('#bTo').value };
  });
  ok(goSheet.titel === 'Einkaufen', '.task__go öffnet den Block-Editor vorausgefüllt: ' + goSheet.titel);
  const [hv, mv] = goSheet.von.split(':').map(Number), [hb, mb] = goSheet.bis.split(':').map(Number);
  ok((hb*60+mb) - (hv*60+mv) === 30, '.task__go übernimmt die hinterlegte Dauer (30 Min): ' + goSheet.von + '–' + goSheet.bis);
  await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(350);

  const gliederung2 = await p.evaluate(() => ({
    labels: [...document.querySelectorAll('#taskList .agenda__label')].map(e => e.textContent.trim()),
    eingeplant: (() => {
      const kopf = [...document.querySelectorAll('#taskList .agenda__label')].find(e => e.textContent === 'Eingeplant');
      const titel = [];
      let n = kopf ? kopf.nextElementSibling : null;
      while (n && n.classList.contains('task')) { titel.push(n.querySelector('.task__title').textContent.trim()); n = n.nextElementSibling; }
      return titel;
    })(),
    ohnePlatz: (() => {
      const kopf = [...document.querySelectorAll('#taskList .agenda__label')].find(e => e.textContent === 'Ohne Platz');
      const titel = [];
      let n = kopf ? kopf.nextElementSibling : null;
      while (n && n.classList.contains('task')) { titel.push(n.querySelector('.task__title').textContent.trim()); n = n.nextElementSibling; }
      return titel;
    })(),
    foot: document.getElementById('tasksFoot').textContent,
    geplant: state.tasks.find(x => x.id === 't2').geplant != null
  }));
  console.log('4) Gliederung (Einkaufen eingeplant):', JSON.stringify(gliederung2));
  ok(JSON.stringify(gliederung2.labels.map(l => l.replace(/[⌄⌃]$/, ''))) === JSON.stringify(['Heute zählt','Ohne Platz','Eingeplant','Erledigt (1)']),
     'Eingeplant erscheint nur, wenn etwas drin steht: ' + gliederung2.labels.join(' / '));
  ok(gliederung2.geplant, 't2.geplant ist gesetzt');
  ok(gliederung2.eingeplant.length === 1 && gliederung2.eingeplant[0] === 'Einkaufen', 'Eingeplant enthält Einkaufen');
  ok(JSON.stringify(gliederung2.ohnePlatz) === JSON.stringify(['Hausarbeit','Zeugnis abholen']), 'Ohne Platz ohne Einkaufen: ' + gliederung2.ohnePlatz.join(', '));
  ok(gliederung2.foot === '1 von 3 Aufgaben haben einen Platz diese Woche.', 'Fusszeile aktualisiert: ' + gliederung2.foot);

  // ---- Ohne Stern: die ruhige Einladung statt des Frog-Kopfs ----
  const einladung = await p.evaluate(() => {
    state.tasks.find(x => x.id === 't3').frog = false; save(); renderAll();
    const e = document.querySelector('.tasks__invite');
    return e ? e.textContent : null;
  });
  ok(!!einladung && einladung.indexOf('Schwerpunkt') >= 0, 'Ohne Stern erscheint die Einladung: ' + einladung);
  await p.evaluate(() => { state.tasks.find(x => x.id === 't3').frog = true; save(); renderAll(); });

  // Stufe 14: die Liste sortiert "ohne Platz" jetzt alphabetisch (Punkt C),
  // "Hausarbeit" steht darum nicht mehr sicher an erster Stelle wie zuvor
  // die reine Anlegereihenfolge — gezielt über den Text greifen statt
  // blind das erste .task zu nehmen.
  await p.click('.task:has-text("Hausarbeit") .task__more'); await p.waitForTimeout(350);
  const blatt = await p.evaluate(() => {
    const s = document.querySelector('.sheet');
    const f = s.querySelector('.sheet__foot').getBoundingClientRect();
    return { titel: s.querySelector('.sheet__title').textContent,
             feld: s.querySelector('#tkTitle').value,
             bereiche: s.querySelectorAll('#tkAreas .chip').length,
             dauern: s.querySelectorAll('#tkDauer .chip').length,
             footSichtbar: f.bottom <= window.innerHeight + 1,
             knoepfe: [...s.querySelectorAll('.sheet__foot button')].map(b=>b.textContent) };
  });
  console.log('5) Blatt:', JSON.stringify(blatt));

  // Titel aendern, Bereich wechseln, Dauer setzen, Stern
  await p.fill('#tkTitle', 'Hausarbeit Kapitel 3');
  await p.evaluate(() => { document.querySelectorAll('#tkAreas .chip')[2].click();
    document.querySelectorAll('#tkDauer .chip')[4].click();
    document.querySelector('#tkFrog').click(); });
  await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(350);
  const nach = await p.evaluate(() => {
    const t = state.tasks.find(x=>x.id==='t1');
    return { titel: t.title, bereich: areaById(t.areaId).name, dauer: t.dauer, stern: t.frog,
             zeile: document.querySelector('.task').textContent,
             tagesform: document.getElementById('energyHint').textContent.indexOf('Das Wichtigste')>=0 };
  });
  console.log('6) Gespeichert:', JSON.stringify(nach));

  // In den Plan legen nimmt die Dauer
  await p.click('.task:has-text("Hausarbeit") .task__more'); await p.waitForTimeout(300);
  await p.click('.sheet button:has-text("In den Wochenplan legen")'); await p.waitForTimeout(400);
  const plan = await p.evaluate(() => {
    const s = document.querySelector('.sheet');
    return { titel: s.querySelector('.sheet__title').textContent,
             von: s.querySelector('#bFrom').value, bis: s.querySelector('#bTo').value };
  });
  console.log('7) In den Plan:', JSON.stringify(plan));
  await p.evaluate(() => closeModal());

  // Loeschen
  await p.click('.task:has-text("Hausarbeit") .task__more'); await p.waitForTimeout(300);
  await p.click('.sheet__foot .btn--danger'); await p.waitForTimeout(400);
  console.log('8) Nach Löschen:', await p.evaluate(() => ({ anzahl: state.tasks.length,
    rueckgaengig: !!document.querySelector('.toast__act') })));

  console.log('\nFehler (Konsole):', errs.length ? errs : 'keine');
  if (errs.length) fehler.push('Konsolenfehler: ' + errs.join(' | '));
  console.log('\n' + (fehler.length ? fehler.length + ' FEHLER:' : 'Alle Prüfungen bestanden.'));
  fehler.forEach(f => console.log(' - ' + f));
  await br.close();
  process.exit(fehler.length ? 1 : 0);
})();
