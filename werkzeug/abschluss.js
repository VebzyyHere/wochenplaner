// Abnahme der Arbeitsbereiche und des Speicherfehlers: echte Wege statt
// CSS-Sollwerte. Die Uhr bleibt über Wochenwechsel und Sommerzeit stabil.
const { chromium } = require('playwright');
const { pathToFileURL } = require('url');
const path = require('path');
const assert = require('assert/strict');
const quelle = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
let anzahl = 0;
const ok = (wert, text) => { assert.ok(wert, text); anzahl++; console.log('OK ' + text); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true, timezoneId: 'Europe/Berlin' });
    const page = await context.newPage(); const fehler = [];
    page.on('pageerror', e => fehler.push(e.message));
    await page.clock.setFixedTime(new Date('2026-09-09T10:15:00+02:00'));
    await page.goto(quelle); await page.waitForFunction(() => syncSettled);
    await page.evaluate(() => { closeModal(); state.profile.name = 'Abnahme'; save(); renderAll(); });
    await page.locator('#panelNav [data-panel="aufgaben"]').click();
    await page.locator('#taskInput').fill('Vorhandene Planung erhalten');
    await page.locator('#taskForm button').click();
    const bestand = await page.evaluate(() => JSON.stringify({ tasks: state.tasks, blocks: state.blocks }));
    for (const bereich of ['heute', 'ziele', 'aufgaben']) {
      await page.locator('#panelNav [data-panel="' + bereich + '"]').click();
      ok(await page.locator('.panel > .card:visible').evaluateAll((cards, v) => cards.length > 0 && cards.every(c => c.dataset.card === v), bereich), 'Desktop zeigt nur den gewählten Arbeitsbereich: ' + bereich);
      ok(await page.locator('#gridWrap').isVisible(), 'Kalender bleibt neben ' + bereich + ' erreichbar');
    }
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.locator('#tabbar [data-view="heute"]').tap();
    await page.locator('#daySwitch .dayswitch__btn').nth(4).tap();
    ok(await page.evaluate(() => selectedDayIdx === 4), 'Tag im Tablet-Arbeitsbereich per Touch auswählbar');
    await page.locator('#tabbar [data-view="plan"]').tap();
    ok(await page.evaluate(() => document.querySelectorAll('.daycol').length === 7 && document.querySelector('#gridWrap').scrollWidth <= document.querySelector('#gridWrap').clientWidth + 1), 'Tablet zeigt alle sieben Tage ohne seitliches Scrollen');
    await page.locator('#tabbar [data-view="aufgaben"]').tap();
    await page.setViewportSize({ width: 1180, height: 820 });
    ok(await page.locator('#taskInput').isVisible() && await page.locator('#gridWrap').isVisible(), 'Beim Drehen bleibt der ausgewählte Arbeitsbereich neben dem Kalender erhalten');
    ok(await page.evaluate(() => JSON.stringify({ tasks: state.tasks, blocks: state.blocks })) === bestand, 'Navigation und Größenwechsel verändern Aufgaben und Termine nicht');
    await page.reload(); await page.waitForFunction(() => syncSettled);
    ok(await page.evaluate(() => state.tasks.some(t => t.title === 'Vorhandene Planung erhalten') && state.version === 10), 'Neuladen erhält die Aufgabe ohne neue Datenmigration');
    await page.setViewportSize({ width: 393, height: 852 });
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--safe-top', '59px');
      document.documentElement.style.setProperty('--safe-bottom', '34px');
      window.dispatchEvent(new Event('wp-speicher-voll'));
    });
    await page.locator('#tabbar [data-view="aufgaben"]').tap();
    ok(await page.locator('#taskInput').isVisible(), 'Speicherwarnung lässt die untere Navigation weiter bedienen');
    ok(await page.evaluate(() => {
      const tab = document.querySelector('#tabbar').getBoundingClientRect();
      const warn = document.querySelector('.banner').getBoundingClientRect();
      return tab.bottom <= innerHeight + 1 && warn.top >= 0;
    }), 'Warnung und Navigation bleiben gemeinsam im sichtbaren Fenster');
    await page.locator('#settingsBtn').tap();
    ok(await page.locator('.sheet').isVisible(), 'Sicherung bleibt nach Speicherwarnung über Einstellungen erreichbar');
    ok(!/Vorschau-Modus|\bv\d+\.\d+\b|Version\s+\d/i.test(await page.locator('body').innerText()), 'Keine Entwicklungs- oder Versionsdekoration im Produkt');
    await page.keyboard.press('Escape');
    ok(await page.locator('.scrim').count() === 0, 'Dialog lässt sich per Escape schließen');
    ok(fehler.length === 0, 'Keine JavaScript-Fehler in den Abschlussabläufen');
    await context.close();
    console.log(anzahl + ' Abschluss-Prüfungen bestanden.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
