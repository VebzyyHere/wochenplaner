/* ============================================================
   Pruefskript Wischen zum Tagwechsel (Stufe 8 erweitert)

   Bis Stufe 8 prueft dieses Skript nur geste(-120, 0) — dy exakt 0, eine
   Bahn, die kein Finger je zeichnet. wischenEinrichten() entscheidet die
   Achse seit Stufe 8 aber ueber ein Verhaeltnis (|dx| > |dy|*1.7, ab
   10px Bewegung) statt fester Schwellen (vorher dy>24 abbrechen, dx<55
   kein Wechsel), und loest zusaetzlich ueber die Geschwindigkeit aus
   (|dx|/Zeit >= 0.4 px/ms) — mit dy=0 kann weder die Achsenwahl noch die
   Geschwindigkeitsschwelle je geprueft werden.

   WICHTIG zur Methode: Die Geschwindigkeitsschwelle haengt an
   e.timeStamp, also an echtem Timing. Per el.dispatchEvent(new
   PointerEvent(...)) erzeugte Events sind "untrusted" — ein erster
   Versuch damit meldete faelschlich, dass schon ein kurzes, schnelles
   Wackeln (-30,0 ueber 60ms) den Tag wechselt; am echten, ueber CDP
   erzeugten ("trusted") Touch-Input tut es das nicht (vermutlich, weil
   Chromium echte Touch-Bewegungen anders buendelt/terminiert als
   synthetische Pointerevents im 10ms-Takt). Alle Wisch-Gesten hier laufen
   deshalb ueber echte Touch-Events (Input.dispatchTouchEvent) statt uber
   dispatchEvent — nur so ist das Ergebnis fuer die geschwindigkeits-
   abhaengigen Faelle vertrauenswuerdig.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK   ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(600);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);
  await p.evaluate(() => setView('plan'));
  await p.waitForTimeout(150);

  const cdp = await c.newCDPSession(p);

  // Echte, "trusted" Touch-Geste ueber CDP statt dispatchEvent — s. Kopf-
  // kommentar. dauerMs default 60ms, realistisch fuer einen zuegigen Wisch.
  const geste = async (dx, dy, dauerMs = 60) => {
    const r = await p.evaluate(() => {
      const el = document.querySelector('.gridwrap');
      const rr = el.getBoundingClientRect();
      return { x: rr.left + rr.width / 2, y: rr.top + rr.height / 2 };
    });
    const steps = 6, stepMs = dauerMs / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y }] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.x + dx * i / steps, y: r.y + dy * i / steps }] });
      await p.waitForTimeout(stepMs);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(250);
    return p.evaluate(() => ({ tag: DAY_SHORT[selectedDayIdx], woche: isoWeek(mondayOf(anchor)) }));
  };

  const start = await p.evaluate(() => ({ tag: DAY_SHORT[selectedDayIdx], woche: isoWeek(mondayOf(anchor)) }));
  console.log('Start:                    ', JSON.stringify(start));

  let vorher = start;
  let r = await geste(-120, 0);
  console.log('Wischen nach links (-120): ', JSON.stringify(r), '→ ein Tag weiter');
  ok(r.tag !== vorher.tag, 'Wischen nach links (-120,0) wechselt den Tag'); vorher = r;

  r = await geste(-120, 0);
  console.log('Nochmal links:             ', JSON.stringify(r));
  ok(r.tag !== vorher.tag, 'Nochmaliges Wischen nach links wechselt wieder'); vorher = r;

  r = await geste(120, 0);
  console.log('Wischen nach rechts (+120):', JSON.stringify(r), '→ ein Tag zurück');
  ok(r.tag !== vorher.tag, 'Wischen nach rechts (+120,0) wechselt den Tag zurueck'); const nachRechts = r;

  r = await geste(0, -140);
  console.log('Senkrecht wischen (Scroll):', JSON.stringify(r), '→ darf sich NICHT ändern');
  ok(r.tag === nachRechts.tag && r.woche === nachRechts.woche, 'Rein senkrechtes Wischen (0,-140) wechselt den Tag NICHT');

  r = await geste(-30, 0);
  console.log('Kurzes Wackeln (30px):     ', JSON.stringify(r), '→ darf sich NICHT ändern');
  ok(r.tag === nachRechts.tag && r.woche === nachRechts.woche, 'Kurzes, schnelles Wackeln (-30,0 in 60ms, ~500px/s) wechselt NICHT');

  /* ---- Neu in Stufe 8: Verhaeltnis- UND geschwindigkeitsbasierte Achse ----
     |dx| > |dy| * 1.7 entscheidet die Achse (ab 10px Bewegung), Ausloesung
     bei |dx|/Breite >= 0.25 ODER |dx|/Zeit >= 0.4 px/ms. Eine echte
     Daumenbahn ist nie exakt waagerecht — geste(-120,0) allein prueft
     weder die Achsenwahl noch die Geschwindigkeitsschwelle. */
  const vorSchraeg = await p.evaluate(() => ({ tag: DAY_SHORT[selectedDayIdx], woche: isoWeek(mondayOf(anchor)) }));

  r = await geste(-90, 30);
  console.log('Schraeg, ueberwiegend x (-90,30):', JSON.stringify(r), '→ MUSS den Tag wechseln (|dx|90 > |dy|*1.7=51)');
  ok(r.tag !== vorSchraeg.tag, 'geste(-90,30): |dx| > |dy|*1.7 -> Achse x -> Tag wechselt');
  const nachSchraegX = r;

  r = await geste(-30, 80);
  console.log('Schraeg, ueberwiegend y (-30,80):', JSON.stringify(r), '→ darf NICHT wechseln (|dx|30 < |dy|*1.7=136)');
  ok(r.tag === nachSchraegX.tag && r.woche === nachSchraegX.woche, 'geste(-30,80): |dx| < |dy|*1.7 -> Achse y -> Tag wechselt NICHT');

  // Über den Wochenrand
  await p.evaluate(() => { selectedDayIdx = 6; renderAll(); });
  const vorSonntag = await p.evaluate(() => ({ tag: DAY_SHORT[selectedDayIdx], woche: isoWeek(mondayOf(anchor)) }));
  r = await geste(-120, 0);
  console.log('Von Sonntag nach links:    ', JSON.stringify(r), '→ Montag der Folgewoche');
  ok(r.tag === 'Mo' && r.woche !== vorSonntag.woche, 'Von Sonntag nach links: Montag der Folgewoche');

  await p.evaluate(() => { selectedDayIdx = 0; renderAll(); });
  const vorMontag = await p.evaluate(() => ({ tag: DAY_SHORT[selectedDayIdx], woche: isoWeek(mondayOf(anchor)) }));
  r = await geste(120, 0);
  console.log('Von Montag nach rechts:    ', JSON.stringify(r), '→ Sonntag der Vorwoche');
  ok(r.tag === 'So' && r.woche !== vorMontag.woche, 'Von Montag nach rechts: Sonntag der Vorwoche');

  // Longpress darf weiter funktionieren — kein Timing-/Geschwindigkeits-
  // bezug, synthetisches dispatchEvent reicht hier (wie in tap2.js).
  const lp = await p.evaluate(async () => {
    const el = document.querySelector('.daycol');
    const r = el.getBoundingClientRect();
    const x = r.left + r.width/2, y = r.top + 120;
    el.dispatchEvent(new PointerEvent('pointerdown', {pointerId:1,pointerType:'touch',isPrimary:true,bubbles:true,cancelable:true,clientX:x,clientY:y}));
    await new Promise(r=>setTimeout(r,520));
    document.dispatchEvent(new PointerEvent('pointerup', {pointerId:1,pointerType:'touch',bubbles:true,clientX:x,clientY:y}));
    await new Promise(r=>setTimeout(r,250));
    return !!document.querySelector('.sheet');
  });
  console.log('\nLanges Druecken legt noch an:', lp, '(soll: true)');
  ok(lp === true, 'Langes Druecken auf freier Flaeche legt weiterhin einen Eintrag an');

  console.log('Konsolenfehler:', errs.length ? errs : 'keine');
  fehler.push(...errs);
  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  await b.close();
  process.exit(fehler.length ? 1 : 0);
})();
