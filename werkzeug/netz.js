/* ============================================================
   Pruefskript Netz — das Sicherheitsnetz vor der v9-Migration
   (Store.backupVorV9/hasVorV9/loadVorV9, Aufruf in migrate()).

   a) Ein v8-Stand wird migriert -> die Sicherung entsteht und enthaelt
      den UNVERAENDERTEN v8-Stand (nicht den migrierten).
   b) Ein zweiter migrate()-Durchlauf mit einem ANDEREN v8-Stand
      ueberschreibt die Sicherung NICHT.
   c) Ein Stand, der schon version 9 ist, erzeugt beim Migrieren KEINE
      Sicherung.
   d) Die Wiederherstellung (Einstellungen -> Daten und Sicherung) stellt
      den urspruenglichen v8-Stand her, migrate() greift erneut, kein
      Absturz.
   e) snapshot()/recHash()/mergeStates() beruehren die Sicherung nicht --
      weder im Quelltext (kein Verweis auf Store oder "vor-v9") noch im
      Verhalten (localStorage bleibt beim Aufruf unveraendert).
   f) Der Wiederherstellen-Knopf in den Einstellungen erscheint nur, wenn
      eine Sicherung existiert.

   Stil wie rt.js/schleife.js: migrate() wird direkt aufgerufen statt per
   Seiten-Reload zu testen -- das ist dieselbe Codestelle, die beim echten
   Laden durchlaeuft (migrate() ist laut Projektdokumentation "die einzige
   Schema-Stelle"), und vermeidet den Erststart-Assistenten, der bei einem
   Reload mit leerem localStorage sonst dazwischenfunkt.
   Eine Chromium-Seite, deutsche Ausgabe, Exit 1 bei Fehlern.
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

  // ==============================================================
  // a) Sicherung entsteht beim Migrieren eines v8-Stands, unveraendert
  // ==============================================================
  console.log('=== a) Sicherung entsteht, unveraendert ===');
  const a1 = await p.evaluate(() => {
    localStorage.clear();
    const alt = freshState(); // freshState() liefert bewusst version:8
    alt.blocks.push({ id: 'netzmarker-a', title: 'Netzwerktest-Marker-A', areaId: 'a1', day: 0,
      date: iso(mondayOf(new Date())), repeat: 'none', start: 9 * 60, end: 10 * 60, frog: false });
    alt.marker = 'NETZ-MARKER-A';
    const vorMigrate = JSON.parse(JSON.stringify(alt));
    migrate(alt);
    const raw = localStorage.getItem('wochenplaner.local.vor-v9');
    return { vorMigrate, nachVersion: alt.version, backup: raw ? JSON.parse(raw) : null };
  });
  console.log('nach migrate(): version', a1.nachVersion, '| Sicherung vorhanden:', !!a1.backup);
  ok(!!a1.backup, 'a) die Sicherung entsteht beim Migrieren eines v8-Stands');
  ok(a1.nachVersion === 9, 'a) der migrierte Stand ist auf version 9 (' + a1.nachVersion + ')');
  ok(JSON.stringify(a1.backup) === JSON.stringify(a1.vorMigrate),
    'a) die Sicherung ist byte-identisch mit dem Stand VOR migrate() (nicht dem migrierten)');
  ok(!!a1.backup && a1.backup.version === 8, 'a) die Sicherung traegt version 8 (' + (a1.backup && a1.backup.version) + ')');
  ok(!!a1.backup && a1.backup.marker === 'NETZ-MARKER-A', 'a) der Marker der Sicherung stimmt');

  // ==============================================================
  // b) Ein zweiter migrate()-Durchlauf ueberschreibt die Sicherung nicht
  // ==============================================================
  console.log('\n=== b) Zweiter Durchlauf ueberschreibt nicht ===');
  const b1 = await p.evaluate(() => {
    const alt2 = freshState();
    alt2.marker = 'NETZ-MARKER-B-SOLLTE-NICHT-LANDEN';
    alt2.blocks.push({ id: 'netzmarker-b', title: 'Zweiter Ladevorgang', areaId: 'a1', day: 1,
      date: iso(addDays(mondayOf(new Date()), 1)), repeat: 'none', start: 11 * 60, end: 12 * 60, frog: false });
    migrate(alt2);
    const raw = localStorage.getItem('wochenplaner.local.vor-v9');
    return { alt2Version: alt2.version, backup: raw ? JSON.parse(raw) : null };
  });
  ok(b1.alt2Version === 9, 'b) der zweite Stand wird trotzdem ganz normal migriert (' + b1.alt2Version + ')');
  ok(!!b1.backup && b1.backup.marker === 'NETZ-MARKER-A', 'b) die Sicherung zeigt weiter den ERSTEN Marker (' + (b1.backup && b1.backup.marker) + ')');
  ok(!!b1.backup && !b1.backup.blocks.some(x => x.title === 'Zweiter Ladevorgang'),
    'b) der Block aus dem zweiten Durchlauf landet NICHT in der Sicherung');

  // ==============================================================
  // d) + f (vorhanden) — Wiederherstellen ueber die Einstellungen
  // ==============================================================
  console.log('\n=== d)+f) Wiederherstellen und Sichtbarkeit des Knopfs ===');
  await p.click('#settingsBtn');
  await p.waitForTimeout(400);
  await p.click('.setmenu__item:has-text("Daten und Sicherung")');
  await p.waitForTimeout(250);
  const f1 = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('#sVorV9 button')];
    return { anzahl: btns.length, texte: btns.map(x => x.textContent) };
  });
  console.log('Knopf bei vorhandener Sicherung:', JSON.stringify(f1));
  ok(f1.anzahl === 1, 'f) genau ein Wiederherstellen-Knopf erscheint, wenn eine Sicherung existiert (' + f1.anzahl + ')');
  ok(!!f1.texte[0] && /wiederherstellen/i.test(f1.texte[0]), 'f) Knopftext nennt "wiederherstellen" (' + JSON.stringify(f1.texte) + ')');

  await p.click('#sVorV9 button');
  await p.waitForTimeout(250);
  const confirmTitel = await p.evaluate(() => {
    const t = document.querySelector('.sheet__title');
    return t ? t.textContent : null;
  });
  console.log('Rueckfrage-Titel:', confirmTitel);
  ok(confirmTitel === 'Alten Stand wiederherstellen?', 'd) die Rueckfrage erscheint vor der Wiederherstellung (' + confirmTitel + ')');

  await p.click('.sheet__foot button:has-text("Wiederherstellen")');
  await p.waitForTimeout(300);
  const d1 = await p.evaluate(() => ({
    version: state.version,
    marker: state.marker,
    hatMarkerBlock: state.blocks.some(x => x.title === 'Netzwerktest-Marker-A'),
    hatZweitenBlock: state.blocks.some(x => x.title === 'Zweiter Ladevorgang'),
    keinDialogOffen: !document.querySelector('.sheet')
  }));
  console.log('Nach Wiederherstellen:', JSON.stringify(d1));
  ok(d1.version === 9, 'd) der wiederhergestellte Stand ist migriert (version ' + d1.version + ')');
  ok(d1.marker === 'NETZ-MARKER-A', 'd) der wiederhergestellte Stand ist der urspruengliche v8-Marker-Stand');
  ok(d1.hatMarkerBlock, 'd) der Marker-Block ist wieder im aktiven Plan');
  ok(!d1.hatZweitenBlock, 'd) der Block aus b) ist NICHT im wiederhergestellten Stand');
  ok(d1.keinDialogOffen, 'd) die Rueckfrage schliesst sich nach der Wiederherstellung');

  // App laeuft danach ganz normal weiter — kein Absturz.
  await p.evaluate(() => { setView('heute'); renderAll(); });
  await p.waitForTimeout(200);
  const laeuftWeiter = await p.evaluate(() => !!document.getElementById('tabbar'));
  ok(laeuftWeiter, 'd) die App rendert nach der Wiederherstellung weiter ohne Absturz');

  // ==============================================================
  // c) + f (nicht vorhanden) — ein v9-Stand erzeugt keine Sicherung,
  // ohne Sicherung fehlt der Knopf
  // ==============================================================
  console.log('\n=== c)+f) Kein v9-Backup, kein Knopf ===');
  const c1 = await p.evaluate(() => {
    localStorage.clear();
    const schonV9 = freshState();
    schonV9.version = 9;
    schonV9.marker = 'NETZ-MARKER-C';
    migrate(schonV9);
    const raw = localStorage.getItem('wochenplaner.local.vor-v9');
    return { hatBackup: raw !== null, version: schonV9.version };
  });
  console.log('Ergebnis c):', JSON.stringify(c1));
  ok(!c1.hatBackup, 'c) ein bereits migrierter (v9) Stand erzeugt keine Sicherung');
  ok(c1.version === 9, 'c) Kontrolle: die Version bleibt 9 (' + c1.version + ')');

  await p.click('#settingsBtn');
  await p.waitForTimeout(400);
  await p.click('.setmenu__item:has-text("Daten und Sicherung")');
  await p.waitForTimeout(250);
  const f2 = await p.evaluate(() => document.querySelectorAll('#sVorV9 button').length);
  console.log('Knopf ohne Sicherung:', f2);
  ok(f2 === 0, 'f) ohne vorhandene Sicherung erscheint kein Wiederherstellen-Knopf (' + f2 + ')');
  await p.evaluate(() => closeModal());
  await p.waitForTimeout(150);

  // ==============================================================
  // e) snapshot()/recHash()/mergeStates() beruehren die Sicherung nicht
  // ==============================================================
  console.log('\n=== e) snapshot()/recHash()/mergeStates() lassen die Sicherung in Ruhe ===');
  const e1 = await p.evaluate(() => {
    localStorage.clear();
    const alt = freshState();
    alt.marker = 'NETZ-MARKER-E';
    migrate(alt); // legt wieder eine Sicherung an, gegen die getestet wird

    const quelltext = snapshot.toString() + recHash.toString() + mergeStates.toString();
    const vorherBackup = localStorage.getItem('wochenplaner.local.vor-v9');

    const mine = JSON.parse(JSON.stringify(alt));
    const theirs = JSON.parse(JSON.stringify(alt));
    theirs.blocks.push({ id: 'merge-test', title: 'Merge-Test', areaId: 'a1', day: 2,
      date: iso(addDays(mondayOf(new Date()), 2)), repeat: 'none', start: 8 * 60, end: 9 * 60, frog: false });
    const merged = mergeStates(mine, theirs);
    snapshot(mine);
    recHash({ id: 'x', at: 1 });

    const nachherBackup = localStorage.getItem('wochenplaner.local.vor-v9');
    return {
      referenziertStore: /\bStore\b/.test(quelltext),
      referenziertVorV9: /vor-v9/.test(quelltext),
      backupUnveraendert: vorherBackup === nachherBackup,
      mergedHatMergeTest: merged.blocks.some(x => x.title === 'Merge-Test'),
      mergedHatVorV9Spur: JSON.stringify(merged).includes('vor-v9')
    };
  });
  console.log(JSON.stringify(e1));
  ok(!e1.referenziertStore, 'e) snapshot()/recHash()/mergeStates() referenzieren "Store" nicht im Quelltext');
  ok(!e1.referenziertVorV9, 'e) snapshot()/recHash()/mergeStates() referenzieren "vor-v9" nicht im Quelltext');
  ok(e1.backupUnveraendert, 'e) das Aufrufen von snapshot()/recHash()/mergeStates() aendert die Sicherung im localStorage nicht');
  ok(e1.mergedHatMergeTest, 'e) Kontrolle: mergeStates() funktioniert normal (uebernimmt neue Eintraege)');
  ok(!e1.mergedHatVorV9Spur, 'e) das Ergebnis von mergeStates() enthaelt keine Spur der Sicherung');

  console.log('\nKonsolenfehler:', konsolenfehler.length ? konsolenfehler : 'keine');
  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  await br.close();
  if (fehler.length || konsolenfehler.length) process.exit(1);
})();
