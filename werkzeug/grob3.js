const { chromium, devices } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage();
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(600);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    const set = (id,h) => { const a = state.areas.find(x=>x.id===id); a.plan.goal=h; a.plan.must=true; };
    set("a1",20); set("a2",12); set("a5",8); set("a6",4);
    save(); renderAll(); clearSuggestions(); buildSuggestions(); acceptSuggestions(); save();
    // auf einen Tag mit grobem Block springen
    const g = state.blocks.find(x=>x.grob);
    selectedDayIdx = g.day; renderAll();
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'g4-iphone-band.png' });
  const m = await p.evaluate(() => {
    const el = document.querySelector('#looseBand');
    const r = el.getBoundingClientRect();
    return { oben: Math.round(r.top), unten: Math.round(r.bottom), fenster: window.innerHeight,
             imBild: r.bottom <= window.innerHeight + 1, chips: el.querySelectorAll('.loosechip').length };
  });
  console.log('Band am iPhone:', JSON.stringify(m));
  await b.close();
})();
