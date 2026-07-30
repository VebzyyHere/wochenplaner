const { chromium, devices } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(550);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  // ---- Speichern die Einstellungen noch, obwohl sie jetzt seitenweise sind? ----
  await p.click('#settingsBtn'); await p.waitForTimeout(400);

  // Seite 1: Name
  await p.click('.setmenu__item >> nth=0'); await p.waitForTimeout(250);
  await p.fill('#sName', 'Testname');
  await p.click('.setback'); await p.waitForTimeout(250);

  // Seite 2: Tageszeiten + Schlaf
  await p.click('.setmenu__item >> nth=1'); await p.waitForTimeout(250);
  await p.fill('#sFrom', '5');
  await p.fill('#sTo', '23');
  await p.check('#sSleepOn');
  await p.fill('#sSleepWind', '45');
  await p.click('.setback'); await p.waitForTimeout(250);

  const zwischen = await p.evaluate(() => ({
    kurzText: [...document.querySelectorAll('.setmenu__kurz')].slice(0,2).map(e => e.textContent)
  }));
  console.log('1) Zusammenfassung aktualisiert sich:', JSON.stringify(zwischen));

  // Seite 3: Darstellung umschalten
  await p.click('.setmenu__item >> nth=4'); await p.waitForTimeout(250);
  await p.click('#sTheme button:has-text("Dunkel")'); await p.waitForTimeout(250);
  const dunkel = await p.evaluate(() => document.documentElement.dataset.theme);
  await p.click('.setback'); await p.waitForTimeout(250);
  console.log('2) Dunkelmodus aus den Einstellungen:', dunkel);

  await p.click('.sheet__foot button:has-text("Fertig")'); await p.waitForTimeout(350);

  const gespeichert = await p.evaluate(() => ({
    name: state.profile.name,
    tagVon: state.settings.dayStart, tagBis: state.settings.dayEnd,
    schlafAn: state.settings.sleep.on, ruhe: state.settings.sleep.wind,
    theme: state.settings.theme
  }));
  console.log('3) Nach Fertig gespeichert:', JSON.stringify(gespeichert));

  // Neu laden — bleibt alles?
  await p.reload(); await p.waitForTimeout(700);
  const nachReload = await p.evaluate(() => ({
    name: state.profile.name, tagVon: state.settings.dayStart,
    schlafAn: state.settings.sleep.on, ruhe: state.settings.sleep.wind, theme: state.settings.theme
  }));
  console.log('4) Nach Neuladen:', JSON.stringify(nachReload));

  // Bereiche-Seite: laesst sich noch ein Bereich anlegen?
  await p.click('#settingsBtn'); await p.waitForTimeout(400);
  await p.click('.setmenu__item >> nth=2'); await p.waitForTimeout(250);
  const vorher = await p.evaluate(() => state.areas.length);
  await p.click('#sAddArea'); await p.waitForTimeout(300);
  const nachher = await p.evaluate(() => state.areas.length);
  console.log('5) Bereich anlegen:', vorher, '->', nachher);
  await p.screenshot({ path: 'q-seite-bereiche.png' });
  await p.click('.setback'); await p.waitForTimeout(250);
  await p.screenshot({ path: 'q-menu-final.png' });
  await p.click('.sheet__foot button:has-text("Fertig")'); await p.waitForTimeout(250);

  // Zahnrad wirklich klickbar?
  const zahnrad = await p.evaluate(() => {
    const b = document.getElementById('settingsBtn');
    const r = b.getBoundingClientRect();
    const oben = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
    return { erreichbar: oben === b || b.contains(oben), wasLiegtDrauf: oben ? oben.id || oben.className : null };
  });
  console.log('6) Zahnrad klickbar:', JSON.stringify(zahnrad));

  console.log('\nFehler:', errs.length ? errs : 'keine');
  await b.close();
})();
