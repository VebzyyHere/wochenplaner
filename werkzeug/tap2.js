const { chromium, devices } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage();
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(450);
  // Der Erststart ist jetzt ein Assistent — fuer diesen Test einfach wegklicken
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    const mon = mondayOf(anchor);
    const d = (new Date().getDay()+6)%7;
    state.blocks.push({id:"b1",title:"Arbeit",areaId:"a1",day:d,date:iso(addDays(mon,d)),
      repeat:"none",start:9*60,end:12*60,frog:false});
    state.settings.dayStart = 6; save(); renderAll();
  });
  await p.waitForTimeout(300);

  // Echte Touch-Gesten simulieren
  const geste = (sel, dy, halten) => p.evaluate(async ({sel, dy, halten}) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    const x = r.left + r.width/2, y = r.top + Math.min(60, r.height/2);
    const ev = (typ, yy) => el.dispatchEvent(new PointerEvent(typ, {
      pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true,
      clientX: x, clientY: yy
    }));
    ev('pointerdown', y);
    await new Promise(r => setTimeout(r, halten ? 500 : 60));
    if (dy) {
      for (let i = 1; i <= 8; i++) {
        document.dispatchEvent(new PointerEvent('pointermove', {
          pointerId:1, pointerType:'touch', bubbles:true, clientX:x, clientY: y - i*(dy/8) }));
        await new Promise(r => setTimeout(r, 12));
      }
    }
    document.dispatchEvent(new PointerEvent('pointerup', {
      pointerId:1, pointerType:'touch', bubbles:true, clientX:x, clientY: y - (dy||0) }));
    await new Promise(r => setTimeout(r, 250));
    return !!document.querySelector('.sheet');
  }, {sel, dy, halten});

  const zu = async () => { await p.evaluate(() => closeModal()); await p.waitForTimeout(150); };

  console.log('1) Wischen ueber leere Flaeche  ->', await geste('.daycol', 120, false), ' (soll: false)'); await zu();
  console.log('2) Kurzer Tipp leere Flaeche    ->', await geste('.daycol', 0, false), ' (soll: false)'); await zu();
  console.log('3) Lang druecken leere Flaeche  ->', await geste('.daycol', 0, true),  ' (soll: true)');  await zu();
  console.log('4) Wischen ab Block             ->', await geste('.block', 120, false), ' (soll: false)'); await zu();
  console.log('5) Kurzer Tipp auf Block        ->', await geste('.block', 0, false),  ' (soll: true)');  await zu();
  // 500 ms ohne Bewegung liegt noch unter TAP_TIME (700 ms) — der Editor
  // geht auf. Wer ziehen wollte, hat sich nicht bewegt; aufgehen ist die
  // gutmuetigere Antwort als gar nichts.
  console.log('6) Lang halten auf Block        ->', await geste('.block', 0, true),   ' (soll: true)'); await zu();
  await b.close();
})();
