/* ============================================================
   Pruefskript Blattzu — der Ghost-Click-Doppeltipp aufs Kalender-Icon
   bzw. das KW-Label, waehrend das Monats-/Wochen-Blatt offen ist.

   Der Fund (echter Gebrauch, iPhone 15 Pro): tippt man bei offenem
   Monats-/Wochen-Blatt erneut auf den Ausloeser (#monthBtn/#weekLabel),
   fuehlt sich das Schliessen "unsauber" an. Mechanik (per Repro mit
   page.touchscreen.tap bestaetigt -- p.mouse.click zeigt den Fehler NICHT,
   weil Playwright/Chromium den Klick-Zielpunkt fuer Maus-Events anders
   aufloest als fuer echte Touch-Events; Messwerte im Bericht): der Scrim
   schliesst bewusst auf pointerdown (s. Kommentar dort, NICHT aendern) --
   der nachfolgende click desselben Tipps trifft dann den durch das
   Schliessen freigelegten Ausloeser darunter und oeffnet das Blatt sofort
   wieder. Dasselbe Muster macht auch "Klick daneben" riskant (koennte ein
   anderes Topbar-Icon wie #settingsBtn ausloesen).

   Fix: schluckeNaechstenClick() (index.html, vor modal()) -- ein
   einmaliger document-Listener in der Capture-Phase, scharfgestellt genau
   im Scrim-pointerdown-Schliessweg (modal() UND modalPush()), schluckt den
   naechsten click hoechstens 400ms lang und raeumt sich selbst ab. Muster:
   setTimeout, KEIN Date.now() (Vertrag "Alle zeitkritischen Pruefskripte
   nageln die Uhr fest" -- echte Timer laufen trotz eingefrorener Uhr
   weiter, wie die 300ms-Schonfrist in verteilenMitGate()/doppeltipp.js).

   a)+b) monthBtn/weekLabel: erneuter Tipp auf denselben Ausloeser -> Blatt
         zu und bleibt zu, bei 100ms UND 600ms geprueft.
   c)    Tipp auf #settingsBtn statt auf den Ausloeser selbst: alles zu,
         Einstellungen NICHT offen (der Schlucker ist global, nicht an ein
         Ziel gebunden -- s. Kommentar an schluckeNaechstenClick()).
   d)    Gegenprobe: Blatt schliessen, 500ms warten (Frist laengst
         abgelaufen), #monthBtn tippen -> oeffnet normal.
   e)    Escape schliesst weiterhin sofort, und ein direkt folgender Tipp
         auf #monthBtn (<400ms nach Escape) OEFFNET normal -- der
         Escape-Schliessweg ruft schluckeNaechstenClick() nicht auf.
   f)    Regressionsprobe: Tipp auf freie Scrim-Flaeche schliesst wie
         bisher (unveraendertes Verhalten des eigentlichen Schliessens).

   Feste Uhr, zoniert (Vertrag): Mittwoch 2026-08-05T10:00:00+02:00,
   Europe/Berlin -- dieselbe Fixture wie monat.js, weil das Monatsblatt
   datumsabhaengig rendert (KW-Rinne, Serienprojektion, heute-Kreis).

   Touch-Taps ueber page.touchscreen.tap (nicht p.click/p.mouse.click) --
   nur echte Touch-Events zeigen den Fund (s. o.); ein p.click() mit
   Playwrights Trefferpruefung wuerde ausserdem selbst schon den zweiten
   Tipp anders takten.

   Rot-Beweis (Auftrag): siehe Bericht -- ueber eine Sicherungskopie von
   index.html, Fix zurueckgenommen (schluckeNaechstenClick()-Aufrufe an
   beiden scrim-Listenern entfernt), a)-c) schlagen dort fehl.

   Stil wie monat.js/doppeltipp.js: eine Chromium-Seite (iPhone 15 Pro,
   Touch), deutsche Ausgabe, Exit 1 bei Fehlern.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');
const UHR = '2026-08-05T10:00:00+02:00'; // Mittwoch

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

async function fixtureAufbauen(p) {
  return p.evaluate(() => {
    if (typeof closeModal === 'function') closeModal();
    state = freshState(); migrate(state);
    anchor = new Date(2026, 7, 5); // Mittwoch 5.8. -- dieselbe Woche wie die feste Uhr
    selectedDayIdx = 2;
    save(); setView('heute'); renderAll();
  });
}

async function mitte(p, sel) {
  const box = await p.locator(sel).boundingBox();
  return [box.x + box.width / 2, box.y + box.height / 2];
}
const offen = p => p.evaluate(() => !!document.querySelector('.sheet'));
const titel = p => p.evaluate(() => (document.querySelector('.sheet__title') || {}).textContent || null);

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone 15 Pro'], timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  await p.clock.setFixedTime(new Date(UHR));
  await p.goto(F);
  await p.waitForTimeout(500);

  /* ---- a) #monthBtn: erneuter Tipp auf denselben Ausloeser -------------- */
  console.log('\n=== a) #monthBtn: Ghost-Click-Toggle ===');
  await fixtureAufbauen(p);
  await p.waitForTimeout(150);
  await p.touchscreen.tap(...(await mitte(p, '#monthBtn')));
  await p.waitForTimeout(200);
  ok(await offen(p), 'a) Monatsblatt ist nach dem Oeffnen offen');
  await p.touchscreen.tap(...(await mitte(p, '#monthBtn')));
  await p.waitForTimeout(100);
  ok(!(await offen(p)), 'a) nach 100ms kein Blatt mehr offen (erneuter Tipp auf #monthBtn)');
  await p.waitForTimeout(500);
  ok(!(await offen(p)), 'a) auch nach 600ms bleibt alles zu');

  /* ---- b) #weekLabel: dieselbe Probe --------------------------------- */
  console.log('\n=== b) #weekLabel: Ghost-Click-Toggle ===');
  await fixtureAufbauen(p);
  await p.waitForTimeout(150);
  await p.touchscreen.tap(...(await mitte(p, '#weekLabel')));
  await p.waitForTimeout(200);
  ok(await offen(p), 'b) Wochen-Blatt ist nach dem Oeffnen offen');
  await p.touchscreen.tap(...(await mitte(p, '#weekLabel')));
  await p.waitForTimeout(100);
  ok(!(await offen(p)), 'b) nach 100ms kein Blatt mehr offen (erneuter Tipp auf #weekLabel)');
  await p.waitForTimeout(500);
  ok(!(await offen(p)), 'b) auch nach 600ms bleibt alles zu');

  /* ---- c) Tipp auf ein anderes Topbar-Icon (#settingsBtn) ------------ */
  console.log('\n=== c) Tipp daneben auf #settingsBtn ===');
  await fixtureAufbauen(p);
  await p.waitForTimeout(150);
  await p.touchscreen.tap(...(await mitte(p, '#monthBtn')));
  await p.waitForTimeout(200);
  ok(await offen(p), 'c) Monatsblatt ist nach dem Oeffnen offen');
  await p.touchscreen.tap(...(await mitte(p, '#settingsBtn')));
  await p.waitForTimeout(150);
  ok(!(await offen(p)), 'c) Monatsblatt ist zu nach dem Tipp auf #settingsBtn');
  await p.waitForTimeout(300);
  ok(!(await offen(p)), 'c) Einstellungen sind NICHT aufgesprungen (kein Blatt offen, war: ' + JSON.stringify(await titel(p)) + ')');

  /* ---- d) Gegenprobe: normaler Tipp nach Ablauf der Frist ------------ */
  console.log('\n=== d) Gegenprobe nach Ablauf der Frist ===');
  await fixtureAufbauen(p);
  await p.waitForTimeout(150);
  await p.touchscreen.tap(...(await mitte(p, '#monthBtn')));
  await p.waitForTimeout(200);
  ok(await offen(p), 'd) Monatsblatt ist offen');
  // Schliessweg: Tipp auf freie Scrim-Flaeche (oben links, ausserhalb des Blatts).
  await p.touchscreen.tap(10, 10);
  await p.waitForTimeout(500); // die 400ms-Frist ist laengst abgelaufen
  await p.touchscreen.tap(...(await mitte(p, '#monthBtn')));
  await p.waitForTimeout(200);
  ok(await offen(p), 'd) #monthBtn oeffnet nach Ablauf der Frist wieder normal');
  ok((await titel(p)) === 'August 2026', 'd) Titel "August 2026" (war: ' + JSON.stringify(await titel(p)) + ')');

  /* ---- e) Escape + direkt folgender Tipp: kein Schlucker auf dem Weg -- */
  console.log('\n=== e) Escape + sofortiger Tipp ===');
  await fixtureAufbauen(p);
  await p.waitForTimeout(150);
  await p.touchscreen.tap(...(await mitte(p, '#monthBtn')));
  await p.waitForTimeout(200);
  ok(await offen(p), 'e) Monatsblatt ist offen');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(50);
  ok(!(await offen(p)), 'e) Escape schliesst sofort');
  await p.touchscreen.tap(...(await mitte(p, '#monthBtn'))); // < 400ms nach Escape
  await p.waitForTimeout(200);
  ok(await offen(p), 'e) direkt folgender Tipp auf #monthBtn (< 400ms nach Escape) OEFFNET normal -- kein Schlucker auf dem Escape-Weg');

  /* ---- f) Regressionsprobe: freie Scrim-Flaeche schliesst wie bisher - */
  console.log('\n=== f) Regression: Tipp auf freie Scrim-Flaeche ===');
  await fixtureAufbauen(p);
  await p.waitForTimeout(150);
  await p.touchscreen.tap(...(await mitte(p, '#monthBtn')));
  await p.waitForTimeout(200);
  ok(await offen(p), 'f) Monatsblatt ist offen');
  await p.touchscreen.tap(10, 10); // freie Flaeche, oben links ausserhalb des Blatts
  await p.waitForTimeout(150);
  ok(!(await offen(p)), 'f) Tipp auf freie Scrim-Flaeche schliesst wie bisher');

  ok(!konsolenfehler.length, 'keine Konsolenfehler' + (konsolenfehler.length ? ' — ' + konsolenfehler.join(' | ') : ''));

  await ctx.close();
  await br.close();
  console.log(fehler.length ? '\nROT: ' + fehler.length + ' Zusicherung(en) verletzt' : '\nGRUEN: der Ghost-Click-Schutz haelt');
  if (fehler.length) process.exit(1);
})();
