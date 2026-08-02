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
  const fehler = await p.evaluate(() => {
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    // Anker fest auf einen Montag der naechsten Woche - so bleibt die Woche leer
    // von "schon vergangenen" Tagen, egal an welchem Wochentag der Test laeuft.
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    const set = (id,h) => { const a = state.areas.find(x=>x.id===id); a.plan.goal=h; a.plan.must=true; };
    set("a1",20); set("a2",12); set("a5",8); set("a6",4);
    // placeArea() ruft placeGrob() nur auf, wenn plan.grob=true ist (index.html ~2928).
    // Ein frischer Zustand setzt das nie von selbst: defaultPlan() legt grob:false fest,
    // und die v7-Migration ("grob: p.grob === undefined ? ...") greift nur bei ALTEN
    // Speicherstaenden, wo das Feld fehlte - nicht bei frisch angelegten Bereichen.
    // Frueher verliess sich dieses Skript darauf, dass a5/a6 (Art "erholung") das
    // automatisch bekommen, was bei einer frischen Seite nie zutrifft. Deshalb hier
    // selbst erzwingen statt zu hoffen.
    ["a5", "a6"].forEach(id => { state.areas.find(x => x.id === id).plan.grob = true; });
    save(); renderAll(); clearSuggestions(); buildSuggestions(); acceptSuggestions(); save();
    // auf einen Tag mit grobem Block springen
    const g = state.blocks.find(x => x.grob);
    if (!g) return "Kein grober Block entstanden, obwohl a5/a6 auf plan.grob=true stehen";
    selectedDayIdx = g.day; renderAll();
    return null;
  });
  if (fehler) { console.error("grob3 FEHLER:", fehler); process.exitCode = 1; await b.close(); return; }
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
