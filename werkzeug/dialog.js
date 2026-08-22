/* ============================================================
   Prüfskript Dialog-Barrierefreiheit (Stufe 7) — iPhone SE (320x568)
   Dauerhaft, Exit 1 bei Fehlern.

   Prüft, was Stufe 7 für modal()/modalPush() behauptet:
     a) Tab läuft in einem offenen Blatt NICHT hinter den Scrim — Tab am
        letzten fokussierbaren Element wrappt zurück zum ersten, Shift+Tab
        am ersten zum letzten. Das ist kein Nebeneffekt von .app[inert]:
        #modalRoot, .sr (Sprunglink) und #banner liegen als Geschwister von
        .app außerhalb davon und wären ohne den eigenen Tab-Handler weiter
        erreichbar.
     b) Beim Schließen kehrt der Fokus auf das auslösende Element zurück.
     c) Jeder Dialog hat einen zugänglichen Namen: aria-labelledby zeigt auf
        einen Knoten mit Text.
     d) .app trägt während des Dialogs inert.

   Geprüft an drei über echte Knöpfe geöffneten Ein-Ebenen-Dialogen
   (Einstellungen, Anmelden, Neuer Eintrag) sowie am Zwei-Ebenen-Fall von
   modalPush() (Serien-Rückfrage beim Löschen eines wöchentlichen
   Eintrags) — dort zusätzlich: die aufgesetzte Ebene bekommt einen eigenen
   Tab-Rahmen und einen eigenen Namen, .app bleibt durchgehend inert, und
   "Abbrechen" legt nur die obere Ebene weg, nicht den ganzen Dialog.

   Stil wie haken.js: eine Chromium-Seite, deutsche Ausgabe, Exit 1 bei
   Fehlern. Feste Uhr (Montagmorgen, 2026-08-03T08:00:00+02:00): seit Stufe D
   kann der Erststart-Assistent ein Kapazitaets-Gate oeffnen, ein
   ungenagelter Lauf waere kalendertagabhaengig gruen oder rot.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK   ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

// Dieselbe Selektorliste wie der Tab-Handler in index.html — der Test soll
// genau das prüfen, was die Falle tatsächlich zulässt, nicht mehr.
const FOCUSABLE_SEL = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

async function focusablesCount(p, sel) {
  return p.evaluate(({ sel, FOCUSABLE_SEL }) => {
    const sheet = document.querySelector(sel);
    if (!sheet) return 0;
    return [...sheet.querySelectorAll(FOCUSABLE_SEL)].filter(el => !el.disabled && el.offsetParent !== null).length;
  }, { sel, FOCUSABLE_SEL });
}
async function focusItem(p, sel, index) {
  await p.evaluate(({ sel, FOCUSABLE_SEL, index }) => {
    const sheet = document.querySelector(sel);
    const items = [...sheet.querySelectorAll(FOCUSABLE_SEL)].filter(el => !el.disabled && el.offsetParent !== null);
    const it = index < 0 ? items[items.length + index] : items[index];
    if (it) it.focus();
  }, { sel, FOCUSABLE_SEL, index });
}
async function activeIsItem(p, sel, index) {
  return p.evaluate(({ sel, FOCUSABLE_SEL, index }) => {
    const sheet = document.querySelector(sel);
    const items = [...sheet.querySelectorAll(FOCUSABLE_SEL)].filter(el => !el.disabled && el.offsetParent !== null);
    const it = index < 0 ? items[items.length + index] : items[index];
    return !!it && document.activeElement === it;
  }, { sel, FOCUSABLE_SEL, index });
}
async function accessibleName(p, sel) {
  return p.evaluate(sel => {
    const sheet = document.querySelector(sel);
    if (!sheet) return null;
    const id = sheet.getAttribute('aria-labelledby');
    if (!id) return null;
    const node = document.getElementById(id);
    return node ? node.textContent.trim() : '';
  }, sel);
}
async function appIsInert(p) {
  return p.evaluate(() => {
    const app = document.querySelector('.app');
    if (!app) return null;
    return ('inert' in app) ? app.inert === true : app.getAttribute('aria-hidden') === 'true';
  });
}

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone SE'], timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  await p.clock.setFixedTime(new Date('2026-08-03T08:00:00+02:00'));
  await p.goto(F); await p.waitForTimeout(500);
  // Erststart-Assistent wegklicken (wie haken.js/audit.js).
  for (let i = 0; i < 3; i++) { await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(280); }
  await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(900);

  const pruefeEinEbene = async (name, opener) => {
    console.log('\n## ' + name);
    await p.click(opener);
    await p.waitForTimeout(400);

    const n = await focusablesCount(p, '.sheet');
    ok(n >= 2, 'mindestens zwei fokussierbare Elemente im Blatt (' + n + ')');

    ok((await appIsInert(p)) === true, '.app ist inert, während der Dialog offen ist');

    const nameTxt = await accessibleName(p, '.sheet');
    ok(!!nameTxt, 'aria-labelledby zeigt auf einen Knoten mit Text (' + JSON.stringify(nameTxt) + ')');

    // Tab-Falle vorwärts: vom letzten Element aus wrappt Tab zum ersten.
    await focusItem(p, '.sheet', -1);
    await p.keyboard.press('Tab');
    ok(await activeIsItem(p, '.sheet', 0), 'Tab am letzten Element wrappt zum ersten (bleibt im Dialog)');

    // Tab-Falle rückwärts: vom ersten Element aus wrappt Shift+Tab zum letzten.
    await focusItem(p, '.sheet', 0);
    await p.keyboard.press('Shift+Tab');
    ok(await activeIsItem(p, '.sheet', -1), 'Shift+Tab am ersten Element wrappt zum letzten');

    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    const fokusZurueck = await p.evaluate(sel => document.activeElement === document.querySelector(sel), opener);
    ok(fokusZurueck, 'Fokus kehrt beim Schließen auf das auslösende Element zurück (' + opener + ')');
    ok((await appIsInert(p)) === false, '.app ist nicht mehr inert, nachdem der Dialog geschlossen ist');
  };

  await pruefeEinEbene('Einstellungen (#settingsBtn)', '#settingsBtn');
  await pruefeEinEbene('Anmelden (#syncBadge)', '#syncBadge');

  // #fabAdd ist nur in der Ansicht "plan" sichtbar (body[data-mview="plan"]).
  await p.evaluate(() => setView('plan'));
  await p.waitForTimeout(200);
  await pruefeEinEbene('Neuer Eintrag (#fabAdd)', '#fabAdd');

  /* ---- modalPush(): Serien-Rückfrage beim Löschen ---------------------- */
  console.log('\n## modalPush() — Serien-Rückfrage beim Löschen eines wöchentlichen Eintrags');
  await p.evaluate(() => {
    const dayIdx = (new Date().getDay() + 6) % 7;
    const dayKey = iso(addDays(mondayOf(anchor), dayIdx));
    state.blocks.push({
      id: 'blk-woche-dlg', title: 'Wöchentlich Dialogtest', areaId: state.areas[0].id,
      day: dayIdx, date: dayKey, repeat: 'weekly', since: dayKey, start: 600, end: 630, frog: false
    });
    save();
    editBlock('blk-woche-dlg', dayKey);
  });
  await p.waitForTimeout(400);

  const untenName = await accessibleName(p, '.sheet');
  ok(!!untenName, 'unteres Blatt (Editor) hat einen zugänglichen Namen (' + JSON.stringify(untenName) + ')');

  await p.click(".sheet__foot button:has-text('Löschen')");
  await p.waitForTimeout(300);

  // modalPush() ersetzt das untere Blatt im DOM durch das obere (das untere
  // lebt nur in stashedModal weiter) — deshalb genau EIN .sheet im DOM.
  const anzahlSheets = await p.evaluate(() => document.querySelectorAll('.sheet').length);
  ok(anzahlSheets === 1, 'genau ein .sheet im DOM während der Rückfrage (' + anzahlSheets + ')');

  const obenName = await accessibleName(p, '.sheet');
  ok(!!obenName && obenName.includes('Wöchentlicher Eintrag'), 'aufgesetztes Blatt hat einen eigenen zugänglichen Namen (' + JSON.stringify(obenName) + ')');

  ok((await appIsInert(p)) === true, '.app bleibt inert, während die Rückfrage oben liegt');

  const nPush = await focusablesCount(p, '.sheet');
  ok(nPush === 3, 'genau drei fokussierbare Elemente in der Rückfrage — Abbrechen/Nur diesen Termin/Löschen (' + nPush + ')');
  await focusItem(p, '.sheet', -1);
  await p.keyboard.press('Tab');
  ok(await activeIsItem(p, '.sheet', 0), 'Tab in der Rückfrage wrappt innerhalb der aufgesetzten Ebene');

  await p.click(".sheet__foot button:has-text('Abbrechen')");
  await p.waitForTimeout(300);
  const zurueckImEditor = await accessibleName(p, '.sheet');
  ok(zurueckImEditor === untenName, 'Abbrechen legt nur die obere Ebene weg — das untere Blatt (' + JSON.stringify(untenName) + ') ist wieder da');
  ok((await appIsInert(p)) === true, '.app bleibt inert — der Editor ist ja noch offen');

  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  ok((await appIsInert(p)) === false, '.app ist nicht mehr inert, nachdem auch das untere Blatt geschlossen ist');

  console.log('\n=== Konsolenfehler: ' + (konsolenfehler.length ? konsolenfehler.join(' | ') : 'keine'));
  if (konsolenfehler.length) fehler.push('Konsolenfehler aufgetreten');

  await br.close();
  if (fehler.length) { console.log('\n=== FEHLER (' + fehler.length + '):'); fehler.forEach(f => console.log(' - ' + f)); process.exit(1); }
  console.log('\nAlle Prüfungen bestanden.');
})();
