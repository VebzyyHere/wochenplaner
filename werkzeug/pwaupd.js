const { chromium, devices } = require('playwright');
const fs = require('fs');
(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone 13'], serviceWorkers: 'allow' });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8901/'); await p.waitForTimeout(1500);
  await p.evaluate(() => closeModal());
  console.log('1) Erste Installation, kein Hinweis:', await p.evaluate(() => !!document.querySelector('.toast')));

  // Neue Fassung veröffentlichen
  const sw = require('path').resolve(__dirname, '..', 'sw.js');
  const alt = fs.readFileSync(sw, 'utf8');
  fs.writeFileSync(sw, alt.replace('wp-v1.12', 'wp-v1.13'));
  const html = require('path').resolve(__dirname, '..', 'index.html');
  const h = fs.readFileSync(html, 'utf8');
  fs.writeFileSync(html, h.replace('<title>Wochenplaner</title>', '<title>Wochenplaner NEU</title>'));

  await p.evaluate(() => sucheNeueFassung());
  await p.waitForTimeout(2500);
  const hinweis = await p.evaluate(() => {
    const t = document.querySelector('.toast');
    return t ? { text: t.textContent, knopf: !!t.querySelector('.toast__act') } : null;
  });
  console.log('2) Nach neuer Fassung:', JSON.stringify(hinweis));

  if (hinweis && hinweis.knopf) {
    await p.click('.toast__act');
    await p.waitForTimeout(3000);
    const nach = await p.evaluate(() => ({ titel: document.title }));
    const keys = await p.evaluate(async () => await caches.keys());
    console.log('3) Nach "Jetzt laden":', JSON.stringify(nach), 'Speicher:', JSON.stringify(keys));
  }

  fs.writeFileSync(sw, alt);
  fs.writeFileSync(html, h);
  await br.close(); process.exit(0);
})();
