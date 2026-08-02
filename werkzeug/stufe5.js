/* Prüfskript Stufe 5 (Abhaken & Verschieben ohne Umweg) — Einwegskript,
   Stil wie agenda.js. Nicht Teil der Standardsuite, nur zur Verifikation
   dieser Änderung. */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK   ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone SE'] });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  await p.goto(F); await p.waitForTimeout(500);
  for (let i = 0; i < 3; i++) { await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(280); }
  await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(900);

  // Testblock anlegen: heute, wöchentlich, fest terminiert — bewusst in der
  // Zukunft relativ zu "jetzt", sonst zählt er nicht als "danach" und die
  // Agenda-Zeile fehlt (Uhrzeit des Testlaufs ist nicht steuerbar).
  await p.evaluate(() => {
    state.settings.dayStart = 0; state.settings.dayEnd = 24;
    const dayIdx = (new Date().getDay() + 6) % 7;
    const dayKey = iso(addDays(mondayOf(anchor), dayIdx));
    const cap = m => Math.max(0, Math.min(1439, m));
    const jetzt = new Date().getHours() * 60 + new Date().getMinutes();
    const start = cap(jetzt + 120), end = cap(start + 60);
    state.blocks.push({
      id: 'blk-test', title: 'Testeintrag', areaId: state.areas[0].id,
      day: dayIdx, date: dayKey, repeat: 'weekly', since: dayKey,
      start, end, frog: false
    });
    save(); renderAll();
  });
  await p.waitForTimeout(150);

  /* ---- A) Rasterblock-Haken ------------------------------------------- */
  console.log('\n## A) Haken am Rasterblock');
  await p.evaluate(() => setView('plan'));
  await p.waitForTimeout(150);
  const vorErledigt = await p.evaluate(() => {
    const dayKey = iso(addDays(mondayOf(anchor), (new Date().getDay() + 6) % 7));
    return istErledigt(state.blocks.find(b => b.id === 'blk-test'), dayKey);
  });
  ok(vorErledigt === false, 'vor dem Klick: nicht erledigt');
  await p.click('.block__done');
  await p.waitForTimeout(100);
  const nachKlick = await p.evaluate(() => {
    const dayKey = iso(addDays(mondayOf(anchor), (new Date().getDay() + 6) % 7));
    const b = state.blocks.find(x => x.id === 'blk-test');
    const key = hakenKey(b, dayKey);
    return { erledigt: istErledigt(b, dayKey), keyCount: Object.keys(state.erledigt).length, key };
  });
  ok(nachKlick.erledigt === true, 'nach dem Klick auf .block__done: erledigt (via istErledigt/hakenKey)');
  ok(nachKlick.keyCount === 1, 'genau EIN Schlüssel in state.erledigt (' + nachKlick.keyCount + ')');

  // Blockeditor öffnen — Haken muss dort denselben Zustand zeigen.
  await p.evaluate(() => editBlock('blk-test', iso(addDays(mondayOf(anchor), (new Date().getDay() + 6) % 7))));
  await p.waitForTimeout(150);
  const bDoneChecked = await p.evaluate(() => document.querySelector('#bDone').checked);
  ok(bDoneChecked === true, 'Blockeditor #bDone zeigt denselben Haken');
  await p.click('.sheet__foot .btn'); // Abbrechen
  await p.waitForTimeout(150);

  /* ---- Agenda-Haken bestätigen (Regression) ---------------------------- */
  console.log('\n## Agenda-Haken (Regressionscheck)');
  await p.evaluate(() => { setView('heute'); });
  await p.waitForTimeout(150);
  const agendaCountAfterGrid = await p.evaluate(() => Object.keys(state.erledigt).length);
  ok(agendaCountAfterGrid === 1, 'weiterhin genau EIN Schlüssel nach Wechsel in die Agenda-Ansicht (' + agendaCountAfterGrid + ')');
  const agendaCheckedLive = await p.evaluate(() => document.querySelector('.agenda__check')?.checked);
  ok(agendaCheckedLive === true, 'Agenda-Haken zeigt den im Raster gesetzten Zustand live (renderAll-Sync, nicht nur state) — ' + agendaCheckedLive);

  /* ---- B) Verschieben-Knopf im Blockeditor ----------------------------- */
  console.log('\n## B) Verschieben-Knopf im Blockeditor');
  await p.evaluate(() => setView('plan'));
  await p.waitForTimeout(150);
  await p.evaluate(() => editBlock('blk-test', iso(addDays(mondayOf(anchor), (new Date().getDay() + 6) % 7))));
  await p.waitForTimeout(150);
  const footButtons = await p.evaluate(() => [...document.querySelectorAll('.sheet__foot .btn')].map(b => b.textContent));
  ok(footButtons.includes('Verschieben'), 'Fuss enthält "Verschieben" (' + JSON.stringify(footButtons) + ')');
  const moveBtn = await p.locator('.sheet__foot .btn', { hasText: 'Verschieben' });
  await moveBtn.click();
  await p.waitForTimeout(150);
  const sheetTitleAfterMove = await p.evaluate(() => document.querySelector('.sheet__title')?.textContent);
  ok(sheetTitleAfterMove === 'Verschieben', 'moveSheet ist offen (Titel: ' + sheetTitleAfterMove + ')');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  const modalGoneAfterEscape = await p.evaluate(() => !document.querySelector('.scrim'));
  ok(modalGoneAfterEscape, 'Escape schliesst wirklich alles (kein Rest-Scrim)');

  /* ---- C) modalPush: Abbrechen bei der Serien-Rückfrage ---------------- */
  console.log('\n## C) modalPush — Serien-Rückfrage im Blockeditor');
  await p.evaluate(() => editBlock('blk-test', iso(addDays(mondayOf(anchor), (new Date().getDay() + 6) % 7))));
  await p.waitForTimeout(150);
  await p.fill('#bTitle', 'Halb bearbeitet');
  await p.click('.sheet__foot .btn--danger'); // Löschen -> Serien-Rückfrage
  await p.waitForTimeout(150);
  const confirmOpen = await p.evaluate(() => document.querySelector('.sheet__title')?.textContent);
  ok(confirmOpen === 'Wöchentlicher Eintrag', 'Serien-Rückfrage offen (Titel: ' + confirmOpen + ')');
  const scrimCountDuringConfirm = await p.evaluate(() => document.querySelectorAll('.scrim').length);
  ok(scrimCountDuringConfirm === 1, 'nur EIN sichtbares Scrim (Editor beiseitegelegt, nicht gestapelt) — ' + scrimCountDuringConfirm);
  await p.click('.sheet__foot .btn:not(.btn--primary)'); // Abbrechen im Confirm
  await p.waitForTimeout(150);
  const restored = await p.evaluate(() => ({
    title: document.querySelector('.sheet__title')?.textContent,
    val: document.querySelector('#bTitle')?.value
  }));
  ok(restored.title === 'Eintrag bearbeiten', 'Editor ist zurück (Titel: ' + restored.title + ')');
  ok(restored.val === 'Halb bearbeitet', 'Halb ausgefüllter Titel blieb erhalten (' + restored.val + ')');
  await p.evaluate(() => closeModal());
  await p.waitForTimeout(150);
  const allClosedAfterGlobalClose = await p.evaluate(() => !document.querySelector('.scrim'));
  ok(allClosedAfterGlobalClose, 'closeModal() schliesst danach wirklich alles (kein Stash-Rest)');

  /* ---- D) Langer Druck in der Agenda -> Verschieben --------------------- */
  console.log('\n## D) Langer Druck in der Agenda öffnet Verschieben');
  await p.evaluate(() => setView('heute'));
  await p.waitForTimeout(150);
  const rowBox = await p.evaluate(() => {
    const row = document.querySelector('.agenda__row');
    if (!row) return null;
    const r = row.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (!rowBox) {
    ok(false, 'keine .agenda__row gefunden — Testdaten prüfen');
  } else {
    await p.mouse.move(rowBox.x, rowBox.y);
    await p.mouse.down();
    await p.waitForTimeout(500);
    await p.mouse.up();
    await p.waitForTimeout(150);
    const moveOpenViaLongPress = await p.evaluate(() => document.querySelector('.sheet__title')?.textContent);
    ok(moveOpenViaLongPress === 'Verschieben', 'langer Druck öffnet moveSheet (Titel: ' + moveOpenViaLongPress + ')');
    const cbUnaffected = await p.evaluate(() => document.querySelector('.agenda__check') === null); // Ansicht ist jetzt Modal, Zeile verdeckt — nur Zustand zählt
    const key = await p.evaluate(() => {
      const dayKey = iso(addDays(mondayOf(anchor), (new Date().getDay() + 6) % 7));
      const b = state.blocks.find(x => x.id === 'blk-test');
      return istErledigt(b, dayKey);
    });
    ok(key === true, 'Haken blieb durch den langen Druck unverändert (weiterhin erledigt)');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(150);
  }

  /* ---- kurzer Tipp auf Agenda-Zeile schaltet weiterhin den Haken ------- */
  console.log('\n## Kurzer Tipp auf die Agenda-Zeile schaltet weiterhin den Haken');
  const vor = await p.evaluate(() => {
    const dayKey = iso(addDays(mondayOf(anchor), (new Date().getDay() + 6) % 7));
    return istErledigt(state.blocks.find(x => x.id === 'blk-test'), dayKey);
  });
  await p.click('.agenda__row .agenda__title');
  await p.waitForTimeout(150);
  const nach = await p.evaluate(() => {
    const dayKey = iso(addDays(mondayOf(anchor), (new Date().getDay() + 6) % 7));
    return istErledigt(state.blocks.find(x => x.id === 'blk-test'), dayKey);
  });
  ok(vor === true && nach === false, 'kurzer Tipp hat umgeschaltet (' + vor + ' -> ' + nach + ')');

  console.log('\n=== Konsolenfehler: ' + (konsolenfehler.length ? konsolenfehler.join(' | ') : 'keine'));
  if (konsolenfehler.length) fehler.push('Konsolenfehler aufgetreten');

  await br.close();
  if (fehler.length) { console.log('\n=== FEHLER (' + fehler.length + '):'); fehler.forEach(f => console.log(' - ' + f)); process.exit(1); }
  console.log('\nAlle Prüfungen bestanden.');
})();
