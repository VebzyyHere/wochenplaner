// Release-Regressionen: echte Aufgabenaktionen, Datenerhalt, mobile Dialoge.
// Feste zonierte Uhr: Mittwochnachmittag, auch bei Ausführung am Wochenende.
const { chromium, devices } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');
const assert = require('assert/strict');
const F = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
let checks = 0;
function ok(b, text) { assert.ok(b, text); checks++; console.log('OK ' + text); }
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Berlin' });
    const p = await ctx.newPage(); const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.clock.setFixedTime(new Date('2026-09-09T13:00:00+02:00'));
    await p.goto(F); await p.waitForFunction(() => syncSettled);
    await p.evaluate(() => {
      closeModal(); state = freshState(); migrate(state); state.profile.name = 'Prüfung';
      state.tasks = [{ id:'test', title:'Bericht schreiben', areaId:'a2', dauer:60, done:false, frog:true, geplant:'b1' }];
      state.blocks = [{ id:'b1', title:'Bericht schreiben', areaId:'a2', day:2, date:currentDayIso(), start:840, end:900, repeat:'none', taskId:'test' }];
      state.areas[1].plan.goal = 1; save(); renderAll();
    });
    await p.locator('#panelNav [data-panel="aufgaben"]').click();
    ok(await p.evaluate(() => {
      const r = document.querySelector('#taskInput').getBoundingClientRect(); return r.top >= 0 && r.bottom < innerHeight;
    }), 'Desktop-Navigation bringt die Aufgabeneingabe ins sichtbare Fenster');
    await p.locator('.task__check').click();
    ok(await p.evaluate(() => state.tasks[0].done && istErledigt(state.blocks[0], state.blocks[0].date) && areaIst('a2') === 60), 'Abhaken in Aufgaben aktualisiert Termin und tatsächlichen Fortschritt');
    await p.locator('.tasks__toggle').click();
    await p.locator('.task.is-done .task__check').click();
    ok(await p.evaluate(() => !state.tasks[0].done && !istErledigt(state.blocks[0],state.blocks[0].date)), 'Wieder öffnen setzt denselben Termin zurück');
    await p.locator('.task__more').click();
    await p.locator('#tkTitle').fill('Bericht überarbeiten');
    await p.locator('#tkSchritt').fill('Dokument öffnen <img src=x onerror=alert(1)>');
    await p.locator('.sheet__foot .btn--primary').click();
    ok(await p.evaluate(() => state.blocks[0].title === 'Bericht überarbeiten'), 'Umbenennen einer verplanten Aufgabe aktualisiert auch den Kalendertitel');
    ok(await p.locator('#agenda .agenda__step').textContent().then(t => t.includes('<img')), 'Erster Schritt erscheint sofort und bleibt als Text maskiert');
    ok(await p.locator('#agenda .agenda__step img').count() === 0, 'Nutzertext erzeugt kein HTML');
    await p.locator('.task__more').click();
    await p.locator('#tkSchritt').fill('Nicht speichern');
    await p.getByRole('button',{name:'Abbrechen',exact:true}).click();
    ok(await p.evaluate(() => state.tasks[0].schritt.startsWith('Dokument öffnen')), 'Abbrechen verändert den gespeicherten ersten Schritt nicht');
    await p.reload(); await p.waitForFunction(() => syncSettled);
    ok(await p.evaluate(() => state.tasks[0].schritt.startsWith('Dokument öffnen') && state.version === 10), 'Neuladen erhält Aufgabe und erstes-Schritt-Feld');
    await p.evaluate(() => { anchor = addDays(mondayOf(anchor),7); renderAll(); setView('aufgaben'); });
    ok(await p.locator('#taskList').textContent().then(t => t.includes('Andere Wochen')), 'Termin aus anderer Woche bekommt einen eigenen Abschnitt');
    ok(await p.locator('#tasksFoot').textContent().then(t => t.startsWith('0 von 1') && t.includes('KW 38')), 'Wochenzähler zählt nur bestätigte Termine in der gezeigten Woche');
    await p.locator('.task__more').click();
    await p.getByRole('button',{name:'Eintrag im Plan öffnen',exact:true}).click();
    ok(await p.locator('.sheet__title').textContent() === 'Eintrag bearbeiten', 'Erneutes Einplanen öffnet den vorhandenen Eintrag');
    await p.locator('#bTitle').fill('Bericht fertigstellen');
    await p.locator('.sheet__foot .btn--primary').click();
    ok(await p.evaluate(() => state.blocks.length === 1 && state.tasks[0].geplant === 'b1' && state.blocks[0].date === '2026-09-09'), 'Öffnen aus anderer Woche erzeugt kein Duplikat und verschiebt kein Datum');
    ok(await p.evaluate(() => state.tasks[0].title === 'Bericht fertigstellen'), 'Umbenennen im Plan aktualisiert die verknüpfte Aufgabe');
    await p.evaluate(() => {
      dragTaskId = 'test';
      document.querySelector('.daycol').dispatchEvent(new DragEvent('drop', {bubbles:true,cancelable:true}));
      dragTaskId = null;
    });
    ok(await p.evaluate(() => state.blocks.length === 1) && await p.locator('.sheet__title').textContent() === 'Eintrag bearbeiten', 'Auch ein erneutes Ablegen einer verplanten Aufgabe erzeugt keinen zweiten Termin');
    await p.getByRole('button',{name:'Abbrechen',exact:true}).click();
    await p.evaluate(() => { state.blocks[0].sug = true; save(); renderAll(); setView('aufgaben'); });
    ok(await p.locator('#taskList').textContent().then(t => t.includes('Vorgeschlagen')), 'Vorschlag ist ausdrücklich als Vorschlag sichtbar');
    ok(await p.locator('#tasksFoot').textContent().then(t => t.startsWith('0 von 1') && t.includes('1 noch vorgeschlagen')), 'Vorschlag wird nicht als bestätigter Platz gezählt');
    await p.locator('.task__check').click();
    ok(await p.evaluate(() => !state.blocks[0].sug && state.tasks[0].done && istErledigt(state.blocks[0],state.blocks[0].date)), 'Explizites Erledigen bestätigt die Durchführung eines vorgeschlagenen Termins');
    await p.locator('.tasks__toggle').click();
    await p.getByRole('button',{name:'Erledigte weg',exact:true}).click();
    ok(await p.evaluate(() => state.tasks.length === 0 && state.blocks.length === 1 && !state.blocks[0].taskId), 'Aufräumen erhält den Termin und entfernt seinen Aufgabenverweis');
    const migration = await p.evaluate(() => {
      const alt = freshState(); alt.version = 9;
      alt.tasks = [{id:'x', title:'Altbestand', areaId:'a2', schritt:'  anfangen  ', fremdesFeld:'bleibt', geplant:'alt2'}];
      alt.blocks = ['alt1','alt2'].map(id=>({id,title:'Alte doppelte Planung',areaId:'a2',taskId:'x',day:2,date:'2026-09-09',start:900,end:960,repeat:'none'}));
      migrate(alt); const a = JSON.stringify(alt); migrate(alt);
      const gleich = a === JSON.stringify(alt);
      const invalid = freshState(); invalid.tasks = [{id:'y', schritt:{kaputt:true}}]; migrate(invalid);
      const merged = mergeStates(alt, {...alt, tasks:[{...alt.tasks[0], schritt:'Aktueller Schritt', at:Date.now()+1}]});
      return {gleich, schritt:alt.tasks[0].schritt, bleibt:alt.tasks[0].fremdesFeld, invalid:!invalid.tasks[0].schritt, merge:merged.tasks[0].schritt,
        altErhalten:alt.blocks.length===2 && !alt.blocks[0].taskId && alt.blocks[1].taskId==='x'};
    });
    ok(migration.gleich && migration.schritt === 'anfangen' && migration.bleibt === 'bleibt' && migration.invalid, 'Migration ist idempotent, sichert den Typ und erhält übrige Aufgabenfelder');
    ok(migration.merge === 'Aktueller Schritt', 'Abgleich übernimmt das optionale Feld mit der neueren Aufgabe');
    ok(migration.altErhalten, 'Alte doppelte Termine bleiben erhalten; nur die mehrdeutige Aufgabenverknüpfung wird aufgelöst');
    ok(errors.length === 0, 'Keine JavaScript-Fehler in den neuen Kernabläufen');
    await ctx.close();

    const mobil = await browser.newContext({...devices['iPhone SE'],deviceScaleFactor:1,timezoneId:'Europe/Berlin'});
    const m = await mobil.newPage();
    await m.clock.setFixedTime(new Date('2026-09-09T13:00:00+02:00'));
    await m.goto(F); await m.waitForFunction(() => syncSettled);
    await m.evaluate(() => {
      closeModal(); state.profile.name='Mobil'; state.tasks=[{id:'m',title:'Schritt für Schritt',areaId:'a2',done:false}];
      save(); renderAll(); setView('aufgaben');
    });
    await m.locator('.task__body').focus(); await m.keyboard.press('Enter');
    ok(await m.locator('#tkTitle').isVisible(), 'Aufgabentext ist per Tastatur bedienbar');
    await m.locator('#tkTitle').fill('   '); await m.locator('.sheet__foot .btn--primary').click();
    ok(await m.locator('#tkTitle').isVisible() && await m.evaluate(() => !document.querySelector('#tkTitle').checkValidity()), 'Leerer Titel schließt den Editor nicht stillschweigend');
    await m.locator('#tkTitle').fill('Schritt für Schritt');
    await m.locator('#tkSchritt').fill('A'.repeat(240));
    await m.locator('.sheet__foot .btn--primary').click();
    ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth && parseFloat(getComputedStyle(document.querySelector('#taskInput')).fontSize) >= 16), 'Langer erster Schritt bleibt auf 320 Pixeln im Layout; Eingabeschrift mindestens 16 Pixel');
    await m.evaluate(() => taskSheet(state.tasks[0]));
    // Echte mobile Tastatur nicht emulierbar: kleiner sichtbarer Bereich als
    // begrenzte, nachvollziehbare Layoutprobe statt behaupteter Safari-Abnahme.
    await m.evaluate(() => document.documentElement.style.setProperty('--sicht-hoehe','300px'));
    await m.waitForTimeout(250);
    const dialog = await m.locator('.sheet__foot').boundingBox();
    ok(dialog.y + dialog.height <= 301, 'Dialogfuß bleibt bei 300 Pixeln sichtbarer Höhe erreichbar');
    await m.evaluate(() => {
      closeModal(); document.documentElement.style.removeProperty('--sicht-hoehe');
      document.documentElement.style.fontSize = '150%';
      state.blocks = [{id:'s',title:'Vorschlag',areaId:'a2',day:2,date:currentDayIso(),start:900,end:960,repeat:'none',sug:true}];
      renderAll(); setView('heute');
    });
    await m.waitForTimeout(250);
    const kanten = await m.evaluate(() => {
      const v = document.querySelector('#sugBar').getBoundingClientRect();
      const t = document.querySelector('#daySwitch').getBoundingClientRect();
      return {unten:v.bottom,oben:t.top};
    });
    ok(Math.abs(kanten.unten-kanten.oben)<1, 'Vorschlagsleiste schließt auch bei 150 % Schrift ohne Spalt an den Tagesstreifen an');
    await mobil.close();
    console.log(checks + ' Release-Prüfungen bestanden.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
