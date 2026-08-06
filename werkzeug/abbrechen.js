/* ============================================================
   Pruefskript "Abbrechen" im Ziele-Editor (Stufe 3).

   Befund: Art-, Grob- und Ort-Chips in goalsSheet() schrieben bislang SOFORT
   auf a.plan (p.art = k; p.grob = val; p.ortId = id), waehrend alle anderen
   Felder (must, goal, days, from/to, regeln) erst in row._commit() landen,
   aufgerufen bei "Speichern" bzw. beim Zuklappen von "mehr". Wer eine Art,
   "grob" oder einen Ort antippt und dann abbricht, bekam die Aenderung
   trotzdem — der Knopf hat gelogen.

   Dieses Skript prueft ueber echte Klicks im DOM (keine reine
   page.evaluate-Zustandsmanipulation, das haette den eigentlichen Fehler
   gar nicht gesehen):
     1) Art antippen, per "Abbrechen"-Knopf schliessen  -> a.plan.art unveraendert
     2) Grob antippen, per Escape-Taste schliessen       -> a.plan.grob unveraendert
     3) Ort antippen, per Klick auf den Hintergrund      -> a.plan.ortId unveraendert
     4) Gegenprobe: alle drei antippen, "Speichern"       -> alle drei uebernommen
   Dazwischen wird nach jedem Abbrechen neu geoeffnet und geprueft, dass die
   Chips wieder den ECHTEN (unveraenderten) Zustand zeigen.

   Vierte Tuer "Kreuz": es gibt in diesem Sheet keinen eigenen X-Knopf — modal()
   (index.html ~2298) kennt nur Escape und den Scrim-Klick als generische
   Schliesswege, beide rufen exakt dieselbe closeModal()-Funktion wie der
   "Abbrechen"-Knopf (der schliessende Callback IST closeModal). Es gibt also
   nur drei tatsaechliche Tueren in diesem Haus, nicht vier — alle drei sind
   unten geprueft.

   Uhrzeit/Datum/Zeitzone genagelt (page.clock.setFixedTime, Europe/Berlin) —
   Stil wie regeln.js/tk.js. Exit 1 bei Fehlern.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const p = await br.newPage({ viewport: { width: 1400, height: 950 }, timezoneId: 'Europe/Berlin' });
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  await p.clock.setFixedTime(new Date('2026-08-05T10:00:00'));
  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(200);

  // Fester Ausgangszustand: Bereich "Sport" (a3), ein angelegter Ort, drei
  // Felder auf bekannten Werten. "Sport" ist als Suchtext eindeutig — kein
  // anderer Standardbereich hat per ART_STANDARD die Art "koerper" (deren
  // Hinweistext "Sport" enthaelt), daher keine Verwechslung beim Auswaehlen
  // der Zeile ueber :has-text().
  await p.evaluate(() => {
    state.orte = [{ id: 'o1', name: 'Büro' }];
    const a3 = state.areas.find(x => x.id === 'a3');
    a3.plan.art = 'koerper';
    a3.plan.grob = false;
    a3.plan.ortId = null;
    save();
  });

  const lies = () => p.evaluate(() => {
    const a3 = state.areas.find(x => x.id === 'a3');
    return { art: a3.plan.art, grob: a3.plan.grob, ortId: a3.plan.ortId };
  });

  // Zeilen tragen keine data-id — #gList haengt sie in state.areas-Reihenfolge
  // an, deshalb ueber den Index statt ueber :has-text() ausgewaehlt. Der
  // Textfilter waere hier ein Fehlgriff: ARTEN.koerper.hint enthaelt selbst
  // das Wort "Sport", und sobald der Kopf-Chip angeklickt ist, waere auch
  // dessen aria-pressed in ALLEN Zeilen mit Art "kopf" nicht mehr eindeutig
  // von einer reinen Textsuche unterscheidbar.
  const idx = await p.evaluate(() => state.areas.findIndex(a => a.id === 'a3'));
  const oeffnen = async () => {
    await p.evaluate(() => goalsSheet());
    await p.waitForTimeout(250);
    return p.locator('#gList .goalrow').nth(idx);
  };

  // -------------------------------------------------------------
  // 1) Art antippen ("Kopf" statt "Körper"), dann "Abbrechen".
  // -------------------------------------------------------------
  let reihe = await oeffnen();
  await reihe.locator('.goalrow__art button:has-text("Kopf")').click();
  const artSofort = await reihe.locator('.goalrow__art button:has-text("Kopf")').getAttribute('aria-pressed');
  const hintSofort = await reihe.locator('.goalrow__arthint').textContent();
  ok(artSofort === 'true', '1) Oberflaeche reagiert sofort: "Kopf"-Chip zeigt aria-pressed=true vor dem Schliessen');
  ok(/Konzentration/.test(hintSofort), '1) Hinweistext wechselt sofort auf die Kopf-Beschreibung (' + hintSofort + ')');

  await p.click('.sheet__foot button:has-text("Abbrechen")');
  await p.waitForTimeout(150);
  let z = await lies();
  ok(z.art === 'koerper', '1) Nach "Abbrechen": a.plan.art unveraendert (' + z.art + ', erwartet koerper)');

  // Erneut oeffnen: muss den echten (unveraenderten) Zustand zeigen.
  reihe = await oeffnen();
  const koerperGedrueckt = await reihe.locator('.goalrow__art button:has-text("Körper")').getAttribute('aria-pressed');
  ok(koerperGedrueckt === 'true', '1) Beim Wiederoeffnen zeigt "Körper" wieder aria-pressed=true (nicht "Kopf")');
  await p.click('.sheet__foot button:has-text("Abbrechen")');
  await p.waitForTimeout(150);

  // -------------------------------------------------------------
  // 2) Grob antippen ("Nur Tageszeit"), dann Escape.
  // -------------------------------------------------------------
  reihe = await oeffnen();
  await reihe.locator('.goalrow__grob button:has-text("Nur Tageszeit")').click();
  const grobSofort = await reihe.locator('.goalrow__grob button:has-text("Nur Tageszeit")').getAttribute('aria-pressed');
  ok(grobSofort === 'true', '2) Oberflaeche reagiert sofort: "Nur Tageszeit" zeigt aria-pressed=true vor dem Schliessen');

  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  z = await lies();
  ok(z.grob === false, '2) Nach Escape: a.plan.grob unveraendert (' + z.grob + ', erwartet false)');

  reihe = await oeffnen();
  const festGedrueckt = await reihe.locator('.goalrow__grob button:has-text("Feste Uhrzeit")').getAttribute('aria-pressed');
  ok(festGedrueckt === 'true', '2) Beim Wiederoeffnen zeigt "Feste Uhrzeit" wieder aria-pressed=true');

  // -------------------------------------------------------------
  // 3) Ort antippen ("Büro"), dann Klick auf den Hintergrund (Scrim).
  //    Ort-Chips liegen im aufklappbaren Teil ("mehr") — aufklappen allein
  //    committet nichts (nur das Zuklappen tut das, siehe more.onclick).
  // -------------------------------------------------------------
  await reihe.locator('.goalrow__more').click();
  await p.waitForTimeout(150);
  await reihe.locator('.gOrte button:has-text("Büro")').click();
  const ortSofort = await reihe.locator('.gOrte button:has-text("Büro")').getAttribute('aria-pressed');
  ok(ortSofort === 'true', '3) Oberflaeche reagiert sofort: "Büro"-Chip zeigt aria-pressed=true vor dem Schliessen');

  await p.mouse.click(10, 10);   // eindeutig auf dem Scrim, weit ausserhalb des 560px-Sheets
  await p.waitForTimeout(150);
  z = await lies();
  ok(z.ortId === null, '3) Nach Klick auf den Hintergrund: a.plan.ortId unveraendert (' + z.ortId + ', erwartet null)');

  reihe = await oeffnen();
  await reihe.locator('.goalrow__more').click();
  await p.waitForTimeout(150);
  const egalGedrueckt = await reihe.locator('.gOrte button:has-text("— egal —")').getAttribute('aria-pressed');
  ok(egalGedrueckt === 'true', '3) Beim Wiederoeffnen zeigt "— egal —" wieder aria-pressed=true (nicht "Büro")');

  // -------------------------------------------------------------
  // 4) Gegenprobe: alle drei antippen und mit "Speichern" uebernehmen.
  //    Sonst waere aus dem behobenen Fehler ein neues, kaputtes Feature
  //    geworden (Chips wirken nie mehr, auch nicht beim echten Speichern).
  // -------------------------------------------------------------
  await reihe.locator('.goalrow__art button:has-text("Kopf")').click();
  await reihe.locator('.goalrow__grob button:has-text("Nur Tageszeit")').click();
  await reihe.locator('.gOrte button:has-text("Büro")').click();
  await p.click('.sheet__foot button:has-text("Speichern")');
  await p.waitForTimeout(150);
  z = await lies();
  ok(z.art === 'kopf' && z.grob === true && z.ortId === 'o1',
    '4) Gegenprobe: "Speichern" uebernimmt weiterhin alle drei Felder (' + JSON.stringify(z) + ')');

  console.log('\nKonsolenfehler:', konsolenfehler.length ? konsolenfehler : 'keine');
  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  await br.close();
  if (fehler.length || konsolenfehler.length) process.exit(1);
})();
