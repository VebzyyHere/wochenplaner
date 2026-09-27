/* ============================================================
   Pruefskript Tagesband (v1.41: frei ziehbares Band statt Tag-für-Tag-Wisch)

   .dayswitch (der Tagesstreifen mit sieben Tageschips) hatte bis hierher
   KEINE Wisch-Geste, nur Taps. Dieses Skript
   prueft streifenwischenEinrichten() -- dieselbe Achsen-/Schwellen-/
   Geschwindigkeitslogik wie wischenEinrichten() (Kommentar dort, ~9214),
   nur auf #daySwitch statt #gridWrap angewandt, und die 360/375/393-
   Geometrie der Formatnutzung (W2).

   WICHTIG zur Methode (uebernommen aus wisch.js, gilt hier genauso): die
   Geschwindigkeitsschwelle haengt an echtem e.timeStamp-Timing. Synthetische
   PointerEvents (dispatchEvent) sind "untrusted" und bilden die Schwellen
   NICHT ab -- alle Wisch-Gesten hier laufen deshalb ueber echte, per CDP
   erzeugte Touch-Events (Input.dispatchTouchEvent).

   Feste zonierte Uhr (Hausvertrag CLAUDE.md): 2026-08-10 ist ein Montag,
   die Woche startet also exakt am angezeigten Anker -- gut geeignet, um
   den Wochenrand (Sonntag/Montag) klar zu pruefen.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK   ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

const INDEX = path.resolve(__dirname, '..', 'index.html');

async function neueSeite(br, { width, height, reducedMotion } = {}) {
  const ctx = await br.newContext({
    ...devices['iPhone 15 Pro'],
    viewport: { width: width || 393, height: height || 852 },
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date('2026-08-10T10:00:00+02:00'));
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + INDEX);
  await p.waitForTimeout(600);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);
  await p.evaluate(() => setView('plan'));
  await p.waitForTimeout(150);
  return { ctx, p, errs };
}

// Echte Touch-Geste auf #daySwitch, Startpunkt in der Mitte des Streifens
// (trifft meist einen Chip, wie ein echter Finger auch).
function macheGeste(p, cdp) {
  return async (dx, dy, dauerMs = 60) => {
    const r = await p.evaluate(() => {
      const el = document.getElementById('daySwitch');
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
    return zustand(p);
  };
}

function zustand(p) {
  return p.evaluate(() => ({
    idx: selectedDayIdx, tag: DAY_SHORT[selectedDayIdx],
    woche: isoWeek(mondayOf(anchor)),
    label: document.getElementById('weekLabel') ? document.getElementById('weekLabel').textContent.trim() : '',
  }));
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });

  // ---- a/b/c (v1.41): das Band zieht frei, erst ein Tipp wählt ------
  {
    const { ctx, p, errs } = await neueSeite(b);
    const cdp = await ctx.newCDPSession(p);
    const band = () => p.evaluate(() => {
      const b = document.querySelector('#daySwitch .dayswitch__band');
      return { links: Math.round(b.scrollLeft), breite: b.clientWidth, tage: b.children.length,
        heuteKnopf: !document.querySelector('#daySwitch .dayswitch__heute').hidden };
    });
    const ziehen = async dx => {
      const r = await p.evaluate(() => { const rr = document.getElementById('daySwitch').getBoundingClientRect(); return { x: rr.left + rr.width / 2, y: rr.top + rr.height / 2 }; });
      // echter Finger: Touch-Start, zehn Züge, loslassen (Schwung inklusive)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y }] });
      for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.x + dx * i / 10, y: r.y }] }); await p.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      // Schwung und Einrasten abwarten: bis scrollLeft 400 ms lang stillsteht
      let vorher = -1;
      for (let t = 0; t < 20; t++) {
        await p.waitForTimeout(200);
        const jetzt = await p.evaluate(() => document.querySelector('#daySwitch .dayswitch__band').scrollLeft);
        if (jetzt === vorher && t > 2) break;
        vorher = jetzt;
      }
    };
    const start = await zustand(p), b0 = await band();
    console.log('Start:', JSON.stringify(start), JSON.stringify(b0));
    ok(b0.tage >= 7 * 20, '(a) Das Band trägt viele Wochen (' + b0.tage + ' Tage)');
    ok(await p.evaluate(() => document.querySelectorAll('.dayswitch__btn.is-woche').length === 7), '(a) genau sieben Tage gehören zur gezeigten Woche');
    ok(await p.evaluate(() => { const d = document.querySelector('.dayswitch'); return d.scrollWidth <= d.clientWidth + 1; }), '(a) die Leiste selbst läuft nicht über');

    await ziehen(-300);
    const b1 = await band(), z1 = await zustand(p);
    ok(b1.links > b0.links + 200, '(a) Ziehen nach links scrollt das Band frei weiter (' + b0.links + ' → ' + b1.links + ')');
    ok(z1.idx === start.idx && z1.woche === start.woche, '(a) bloßes Ziehen ändert weder Tag noch Woche');
    ok(b1.heuteKnopf, '(b) ist heute aus dem Bild, erscheint der Heute-Knopf');
    ok(await p.evaluate(() => { const b = document.querySelector('#daySwitch .dayswitch__band'), l = b.getBoundingClientRect().left + parseFloat(getComputedStyle(b).paddingLeft); return [...b.children].some(c => Math.abs(c.getBoundingClientRect().left - l) < 2); }), '(a) das Band rastet an einem Tag ein');

    // Tipp auf einen sichtbaren Tag einer späteren Woche
    const tipp = await p.evaluate(() => {
      const b = document.querySelector('#daySwitch .dayswitch__band');
      const t = [...b.children].find(c => c.offsetLeft >= b.scrollLeft + b.clientWidth / 2 && !c.classList.contains('is-woche'));
      const r = t.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, tag: t.dataset.tag };
    });
    // Chromium verwirft den ersten Tipp nach einem per CDP erzeugten Schwung
    // (Tap-Unterdrückung nach Fling) — deshalb erst ein Tipp ins Leere.
    await p.waitForTimeout(600);
    const leer = await p.evaluate(() => { const r = document.querySelector('.planhead h1, .planhead').getBoundingClientRect(); return { x: r.left + 10, y: r.top + r.height / 2 }; });
    await p.touchscreen.tap(leer.x, leer.y);   // erster Tipp nach dem Schwung: ins Leere
    await p.waitForTimeout(300);
    await p.touchscreen.tap(tipp.x, tipp.y);
    await p.waitForTimeout(300);
    const z2 = await zustand(p), b2 = await band();
    ok(z2.woche !== start.woche && await p.evaluate(t => currentDayIso() === t, tipp.tag), '(c) Tipp auf einen Tag einer anderen Woche wählt genau diesen Tag');
    ok(Math.abs(b2.links - b1.links) < 3, '(c) das Band springt beim Tipp nicht weg');
    ok(z2.label !== start.label, '(c) die Kopfzeile nennt die neue Woche');

    await p.click('#daySwitch .dayswitch__heute');
    await p.waitForTimeout(700);
    const z3 = await zustand(p), b3 = await band();
    ok(z3.woche === start.woche && z3.idx === start.idx, '(b) Heute-Knopf holt Woche und Tag von heute zurück');
    ok(!b3.heuteKnopf, '(b) danach verschwindet der Heute-Knopf');

    console.log('Konsolenfehler:', errs.length ? errs : 'keine');
    fehler.push(...errs);
    await ctx.close();
  }

  // ---- d: Tap bleibt Tap (TAP_SLOP-Probe) ----------------------------
  {
    const { ctx, p, errs } = await neueSeite(b);
    const cdp = await ctx.newCDPSession(p);

    const vor = await zustand(p);
    const ziel = (vor.idx + 3) % 7;   // ein anderer Chip als der aktuelle
    const box = await p.evaluate(z => {
      const btn = document.querySelectorAll('.dayswitch__btn.is-woche')[z];
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, ziel);

    // Fuenf Pixel Wackeln (unter TAP_SLOP=10 und unter der 10px-Achsen-
    // schwelle) -- muss als Tipp durchgehen,
    // NICHT als Wisch gewertet werden.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 5, y: box.y }] });
    await p.waitForTimeout(30);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(200);

    const nach = await zustand(p);
    console.log('(d) Tap auf Chip', ziel, 'mit 5px Wackeln:', JSON.stringify(nach));
    ok(nach.idx === ziel, '(d) Tap mit 5px Wackeln bleibt ein Tap: wechselt exakt zum angetippten Chip');

    console.log('Konsolenfehler:', errs.length ? errs : 'keine');
    fehler.push(...errs);
    await ctx.close();
  }

  // ---- e: Einfache Wochenpfeile im Kopf funktionieren weiter ----------
  {
    const { ctx, p, errs } = await neueSeite(b);
    const vor = await zustand(p);
    await p.locator('#nextWeek').click();
    await p.waitForTimeout(150);
    const nachNext = await zustand(p);
    ok(nachNext.woche !== vor.woche, '(e) Pfeil "Woche vor" funktioniert weiterhin');

    await p.locator('#prevWeek').click();
    await p.waitForTimeout(150);
    const nachPrev = await zustand(p);
    ok(nachPrev.woche === vor.woche, '(e) Pfeil "Woche zurück" funktioniert weiterhin');
    ok(await p.locator('.dayswitch__nav').count() === 0, '(e) Keine doppelten Wochenpfeile im Tagesstreifen');
    // Tastatur: ein Tab-Stopp im Band, Pfeiltasten wandern, Enter wählt
    ok(await p.evaluate(() => document.querySelectorAll('#daySwitch .dayswitch__btn[tabindex="0"]').length === 1), '(e) Band hat genau einen Tab-Stopp');
    await p.focus('#daySwitch .dayswitch__btn[tabindex="0"]');
    await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');
    await p.waitForTimeout(150);
    ok((await zustand(p)).idx === (vor.idx + 2) % 7, '(e) Pfeil rechts zweimal + Enter wählt den übernächsten Tag');

    console.log('Konsolenfehler:', errs.length ? errs : 'keine');
    fehler.push(...errs);
    await ctx.close();
  }

  // ---- f: senkrechtes Wischen auf dem Streifen wird nicht gekapert ---
  {
    const { ctx, p, errs } = await neueSeite(b);
    const cdp = await ctx.newCDPSession(p);
    const geste = macheGeste(p, cdp);
    const vor = await zustand(p);
    const nach = await geste(0, -140);
    console.log('(f) Senkrecht wischen:     ', JSON.stringify(nach), '→ darf sich NICHT ändern');
    ok(nach.idx === vor.idx && nach.woche === vor.woche, '(f) Rein senkrechtes Wischen auf dem Streifen wechselt den Tag NICHT');

    console.log('Konsolenfehler:', errs.length ? errs : 'keine');
    fehler.push(...errs);
    await ctx.close();
  }

  // ---- g: Geometrie 393px --------------------------------------------
  {
    const { ctx, p, errs } = await neueSeite(b);
    const geo = await p.evaluate(() => {
      const chips = [...document.querySelectorAll('.dayswitch__btn.is-woche')].map(c => Math.round(c.getBoundingClientRect().width));
      const cs = getComputedStyle(document.querySelector('.dayswitch__band'));
      const sug = document.querySelector('.agenda__sugacts button');
      const blockSug = document.querySelector('.block__sug button');
      return {
        chips, gap: cs.columnGap,
        sug: sug ? Math.round(sug.getBoundingClientRect().width) : null,
        blockSug: blockSug ? Math.round(blockSug.getBoundingClientRect().width) : null,
      };
    });
    console.log('(g) Geometrie 393px:', JSON.stringify(geo));
    ok(geo.chips.every(w => w >= 44), '(g) Tageschips bei 393px mindestens 44px breit: ' + geo.chips);
    ok(parseFloat(geo.gap) > 2, '(g) Chip-Luecken bei 393px > 2px: ' + geo.gap);
    const reihenfolge = await p.evaluate(() => {
      const top = sel => document.querySelector(sel).getBoundingClientRect().top;
      return [top('.topbar'), top('.dayswitch'), top('.planhead'), top('.gridwrap'), top('.tabbar')];
    });
    ok(reihenfolge.every((y, i) => i === 0 || y > reihenfolge[i - 1]),
      '(g) Sichtbare Reihenfolge entspricht Tastaturfolge: Kopf, Tage, Plankopf, Raster, Tabbar');
    if (geo.sug != null) ok(geo.sug >= 40, '(g) Vorschlags-Checkknopf (Agenda) bei 393px sichtbar >=40px: ' + geo.sug);
    if (geo.blockSug != null) ok(geo.blockSug >= 40, '(g) Vorschlags-Checkknopf (Raster) bei 393px sichtbar >=40px: ' + geo.blockSug);

    console.log('Konsolenfehler:', errs.length ? errs : 'keine');
    fehler.push(...errs);
    await ctx.close();
  }

  // ---- h: Geometrie 320px (SE) ----------------------------------------
  {
    const { ctx, p, errs } = await neueSeite(b, { width: 320, height: 568 });
    const geo = await p.evaluate(() => {
      const chips = [...document.querySelectorAll('.dayswitch__btn.is-woche')].map(n => n.getBoundingClientRect().width);
      const cs = getComputedStyle(document.querySelector('.dayswitch__band'));
      const sug = document.querySelector('.agenda__sugacts button');
      const blockSug = document.querySelector('.block__sug button');
      const hourh = getComputedStyle(document.querySelector('.grid')).getPropertyValue('--hourh').trim();
      return {
        chips, gap: cs.columnGap, hourh,
        sug: sug ? Math.round(sug.getBoundingClientRect().width) : null,
        blockSug: blockSug ? Math.round(blockSug.getBoundingClientRect().width) : null,
      };
    });
    console.log('(h) Geometrie 320px (SE, Zweitkontext):', JSON.stringify(geo));
    ok(geo.chips.every(w => w >= 44), '(h) SE: Tageschips sind mindestens 44px breit: ' + geo.chips);
    ok(parseFloat(geo.gap) === 0, '(h) SE: Tageschips nutzen die volle Breite: ' + geo.gap);
    ok(geo.hourh === '56px', '(h) SE: --hourh bleibt exakt 56px: ' + geo.hourh);
    if (geo.sug != null) ok(geo.sug === 34, '(h) SE: Vorschlags-Checkknopf (Agenda) bleibt 34px: ' + geo.sug);
    if (geo.blockSug != null) ok(geo.blockSug === 34, '(h) SE: Vorschlags-Checkknopf (Raster) bleibt 34px: ' + geo.blockSug);

    console.log('Konsolenfehler:', errs.length ? errs : 'keine');
    fehler.push(...errs);
    await ctx.close();
  }

  // ---- i: prefers-reduced-motion -- Heute-Knopf springt ohne Animation ---
  {
    const { ctx, p, errs } = await neueSeite(b, { reducedMotion: true });
    await p.evaluate(() => { const b = document.querySelector('#daySwitch .dayswitch__band'); b.scrollLeft = b.scrollWidth; });
    await p.waitForTimeout(200);
    await p.click('#daySwitch .dayswitch__heute');
    await p.waitForTimeout(150);
    ok(await p.evaluate(() => { const b = document.querySelector('#daySwitch .dayswitch__band'), t = b.querySelector('.is-today');
      return t.offsetLeft >= b.scrollLeft && t.offsetLeft + t.offsetWidth <= b.scrollLeft + b.clientWidth + 1; }), '(i) reduced-motion: Heute-Knopf bringt heute sofort ins Bild');
    console.log('Konsolenfehler:', errs.length ? errs : 'keine');
    fehler.push(...errs);
    await ctx.close();
  }

  await b.close();

  console.log('\n' + (fehler.length ? fehler.length + ' FEHLER:' : 'Alle Pruefungen bestanden.'));
  fehler.forEach(f => console.log(' - ' + f));
  process.exit(fehler.length ? 1 : 0);
})();
