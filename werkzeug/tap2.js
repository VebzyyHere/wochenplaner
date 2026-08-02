/* ============================================================
   Pruefskript Tippen/Halten auf einen Block (Stufe 8 erweitert)

   1-5 wie bisher (Tippen vs. Wischen auf leerer Flaeche und auf einem
   Block). 6 war bis Stufe 7 "lange halten OHNE Bewegung oeffnet noch den
   Editor" (die "gutmuetige Antwort", TAP_TIME 700ms > HOLD_TIME war noch
   ohne Wirkung, weil es holdToMove gar nicht gab). Seit Stufe 8 hebt ein
   langer Druck auf einen Block ihn zum Verschieben an (holdToMove,
   dieselben 380ms wie holdToCreate) — 500ms Halten OHNE Bewegung loest
   also jetzt den Verschieben-Modus aus (ohne Bewegung ohne Effekt) statt
   noch den Editor zu oeffnen. Test 6 ist entsprechend korrigiert, dazu neu:
     7) langer Druck MIT Bewegung verschiebt um genau ein Raster (15 Min)
     8) kurzer Tipp oeffnet weiterhin den Editor (Wiederholung von 5, zur
        Kontrolle nach dem Verschieben-Test)
     9) ein Scrollversuch, der auf dem Resize-Streifen (.block__resize)
        beginnt, scrollt tatsaechlich (echte Touch-Events per CDP, weil
        touch-action nur vom Browser bei echten, "trusted" Touch-Events
        ausgewertet wird — synthetische PointerEvents loesen kein
        natives Scrollen aus, unabhaengig vom CSS).
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK   ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

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
    state.settings.dayStart = 6; save();
    // Ohne das bleibt die App auf dem mobilen Standard 'heute' — .planwrap
    // (und damit .daycol/.block/.block__resize) hat dann display:none und
    // eine leere getBoundingClientRect(). Die Gesten 1-8 unten dispatchen
    // direkt auf das Element (funktioniert auch bei rect 0x0), Test 9
    // dagegen nutzt echte CDP-Touch-Events, die wirklich an der Bildschirm-
    // position ankommen muessen — dafuer muss das Raster sichtbar sein.
    setView("plan");
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

  let r;
  r = await geste('.daycol', 120, false);
  console.log('1) Wischen ueber leere Flaeche  ->', r, ' (soll: false)'); ok(r === false, '1) Wischen ueber leere Flaeche oeffnet nichts'); await zu();

  r = await geste('.daycol', 0, false);
  console.log('2) Kurzer Tipp leere Flaeche    ->', r, ' (soll: false)'); ok(r === false, '2) Kurzer Tipp auf leere Flaeche oeffnet nichts'); await zu();

  r = await geste('.daycol', 0, true);
  console.log('3) Lang druecken leere Flaeche  ->', r, ' (soll: true)'); ok(r === true, '3) Langer Druck auf leerer Flaeche legt an (holdToCreate)'); await zu();

  r = await geste('.block', 120, false);
  console.log('4) Wischen ab Block             ->', r, ' (soll: false)'); ok(r === false, '4) Wischen ab einem Block oeffnet nichts'); await zu();

  r = await geste('.block', 0, false);
  console.log('5) Kurzer Tipp auf Block        ->', r, ' (soll: true)'); ok(r === true, '5) Kurzer Tipp auf einen Block oeffnet den Editor'); await zu();

  // Seit Stufe 8 (holdToMove, 380ms) hebt ein langer Druck den Block zum
  // Verschieben an, noch bevor tapOrScrolls 700ms-TAP_TIME erreicht ist.
  // tapAbbrechen() unterdrueckt dann die alte "oeffnet trotzdem"-Aufloesung
  // bei pointerup — ohne Bewegung bleibt b.start/b.end unveraendert (der
  // Verschieben-Modus committet dieselbe Position, aus der er startete),
  // aber der Editor geht NICHT mehr auf.
  r = await geste('.block', 0, true);
  console.log('6) Lang halten auf Block, keine Bewegung ->', r, ' (soll: false, seit Stufe 8 holdToMove)');
  ok(r === false, '6) Langer Druck ohne Bewegung startet den Verschieben-Modus statt den Editor zu oeffnen');
  await zu();

  /* ---- 7) Langer Druck MIT Bewegung verschiebt um genau ein Raster ---- */
  const hourH = await p.evaluate(() =>
    parseFloat(getComputedStyle(document.getElementById('grid')).getPropertyValue('--hourh')) || 52);
  const startVorher = await p.evaluate(() => state.blocks.find(x => x.id === 'b1').start);
  const raster = await p.evaluate(() => SNAP);
  const dyRaster = hourH / 60 * raster; // Pixel fuer genau ein 15-Minuten-Raster

  const gesteVerschieben = (sel, dyPx) => p.evaluate(async ({sel, dyPx}) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + Math.min(20, r.height / 2);
    const ev = (typ, yy) => el.dispatchEvent(new PointerEvent(typ, {
      pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true,
      clientX: x, clientY: yy
    }));
    ev('pointerdown', y);
    // Ueber HOLD_TIME (380ms) hinweg warten, OHNE den Finger zu bewegen —
    // erst danach ist der Verschieben-Modus aktiv (startDrag()).
    await new Promise(res => setTimeout(res, 450));
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      document.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 1, pointerType: 'touch', bubbles: true, clientX: x, clientY: y + dyPx * i / steps }));
      await new Promise(res => setTimeout(res, 10));
    }
    document.dispatchEvent(new PointerEvent('pointerup', {
      pointerId: 1, pointerType: 'touch', bubbles: true, clientX: x, clientY: y + dyPx }));
    await new Promise(res => setTimeout(res, 250));
    return !!document.querySelector('.sheet');
  }, {sel, dyPx});

  const dialogNach7 = await gesteVerschieben('.block[data-id="b1"]', dyRaster);
  const startNachher = await p.evaluate(() => state.blocks.find(x => x.id === 'b1').start);
  console.log(`7) Lang halten + verschieben     -> Start ${startVorher} -> ${startNachher} (soll: +${raster}), Editor: ${dialogNach7} (soll: false)`);
  ok(startNachher === startVorher + raster, `7) Verschiebt um genau ein Raster (${raster} Min): ${startVorher} -> ${startNachher}`);
  ok(dialogNach7 === false, '7) Der Editor oeffnet sich beim Verschieben nicht');
  await zu();

  /* ---- 8) Kurzer Tipp oeffnet weiterhin den Editor, auch nach 6/7 ---- */
  r = await geste('.block', 0, false);
  console.log('8) Kurzer Tipp auf Block (danach) ->', r, ' (soll: true)');
  ok(r === true, '8) Kurzer Tipp oeffnet den Editor auch nach den Verschieben-Tests weiterhin');
  await zu();

  /* ---- 9) Scrollversuch auf dem Resize-Streifen scrollt tatsaechlich ----
     .block__resize hatte bis Stufe 8 unbedingt touch-action:none — eine
     14px hohe Totzone, die jeden Scrollversuch, der genau dort beginnt,
     verschluckte (s. index.html ~881-887). Nur echte, "trusted" Touch-
     Events durchlaufen die touch-action-Pruefung des Browsers — dispatchte
     PointerEvents (wie oben) taeten das nicht, deshalb hier per CDP. */
  const handle = await p.evaluate(() => {
    const el = document.querySelector('.block__resize');
    const r = el.getBoundingClientRect();
    const wrap = document.getElementById('gridWrap');
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, scrollTopVorher: wrap.scrollTop };
  });
  const cdp = await c.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: handle.x, y: handle.y }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: handle.x, y: handle.y - i * 15 }] });
    await p.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(300);
  const scrollTopNachher = await p.evaluate(() => document.getElementById('gridWrap').scrollTop);
  console.log(`9) Scrollversuch auf .block__resize -> scrollTop ${handle.scrollTopVorher} -> ${scrollTopNachher} (soll: veraendert)`);
  ok(scrollTopNachher !== handle.scrollTopVorher, '9) Ein am Resize-Streifen begonnener Scrollversuch scrollt tatsaechlich (kein touch-action:none mehr auf coarse-Zeigern)');

  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  await b.close();
  process.exit(fehler.length ? 1 : 0);
})();
