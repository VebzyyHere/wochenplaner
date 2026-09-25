// Aufgabe -> Vorschlag -> Termin; Fehler dürfen keine Zeiten erfinden.
const { chromium } = require('playwright');
const { pathToFileURL } = require('url');
const path = require('path');
const assert = require('assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, timezoneId: 'Europe/Berlin' });
    await page.clock.setFixedTime(new Date('2026-09-09T10:15:00+02:00'));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => syncSettled);
    await page.evaluate(() => { closeModal(); state.profile.name = 'Prüfung'; state.tasks = []; state.blocks = []; save(); renderAll(); setView('aufgaben'); });
    await page.locator('#taskForm button').click();
    assert.equal(await page.locator('#taskInput').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.evaluate(() => state.tasks.length), 0);
    await page.locator('#taskInput').fill('Einkaufen');
    assert.equal(await page.locator('#taskError').isVisible(), false);
    await page.locator('#taskInput').press('Enter');
    await page.getByRole('button', { name: 'In den Wochenplan legen: Einkaufen', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#bTitle,#bDays,#bGenau,#bFrom,#bTo,#bRepeat,#bAreas,#bOrte')].map(el => el.id)),
      ['bTitle', 'bDays', 'bGenau', 'bFrom', 'bTo', 'bRepeat', 'bAreas', 'bOrte'],
      'Titel, Tag und Uhrzeit gehen optionalen Angaben auch in der Tastaturfolge voraus');
    await page.locator('#bFrom').fill('14:00');
    await page.locator('#bTo').fill('13:00');
    await page.getByRole('button', { name: 'Eintragen', exact: true }).click();
    assert.equal(await page.locator('#bZeitError').isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'bTo');
    assert.equal(await page.evaluate(() => state.blocks.length), 0);
    await page.locator('#bTo').fill('');
    await page.getByRole('button', { name: 'Eintragen', exact: true }).click();
    assert.equal(await page.evaluate(() => state.blocks.length), 0);
    await page.locator('#bTo').fill('15:00');
    assert.equal(await page.locator('#bZeitError').isVisible(), false);
    await page.getByRole('button', { name: 'Eintragen', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => [state.blocks[0].start, state.blocks[0].end]), [840, 900]);
    await page.evaluate(() => { state.blocks[0].sug = true; save(); renderAll(); });
    await page.getByRole('button', { name: 'Vorschlag prüfen: Einkaufen', exact: true }).press('Enter');
    await page.getByRole('dialog').getByRole('button', { name: 'Übernehmen', exact: true }).click();
    assert.equal(await page.evaluate(() => !!state.blocks[0].sug), false);
    assert.equal(await page.locator('#taskInput').isVisible(), true, 'Übernehmen bleibt im Aufgabenbereich');
    await page.getByRole('checkbox', { name: 'Erledigt: Einkaufen', exact: true }).click();
    assert.equal(await page.getByText('Alles erledigt.', { exact: true }).isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('tasks__toggle')), true);
    await page.getByRole('button', { name: /Erledigt \(1\)/ }).click();
    await page.getByRole('checkbox', { name: 'Erledigt: Einkaufen', exact: true }).click();
    assert.equal(await page.getByText('Alles erledigt.', { exact: true }).count(), 0);
    console.log('Nutzerablauf: Eingabefehler, unveränderte Daten, Korrektur, Tastatur-Prüfung und Erledigt-Zustand bestanden.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
