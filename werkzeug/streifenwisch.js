/* ============================================================
   Pruefskript Streifen-Wischen (Auftrag "Der Tagesstreifen lernt Wischen")

   .dayswitch (der Tagesstreifen mit den sieben Tageschips + zwei Rand-
   pfeilen) hatte bis hierher KEINE Wisch-Geste, nur Taps. Dieses Skript
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

  // ---- a/b/c: Wischen auf dem Streifen selbst -----------------------
  {
    const { ctx, p, errs } = await neueSeite(b);
    const cdp = await ctx.newCDPSession(p);
    const geste = macheGeste(p, cdp);

    const start = await zustand(p);
    console.log('Start:                     ', JSON.stringify(start));

    let vorher = start;
    let r = await geste(-120, 0);
    console.log('(a) Wischen links (-120):  ', JSON.stringify(r), '→ ein Tag weiter');
    ok(r.idx === vorher.idx + 1, '(a) Wischen links auf dem Streifen: selectedDayIdx+1');
    vorher = r;

    r = await geste(120, 0);
    console.log('(c) Wischen rechts (+120): ', JSON.stringify(r), '→ ein Tag zurück');
    ok(r.idx === vorher.idx - 1, '(c) Wischen rechts auf dem Streifen: selectedDayIdx-1');

    // Inhalt folgt: dieselbe Tagesnummer muss im Raster als aktiver Chip stehen
    const chipAktiv = await p.evaluate(() => {
      const btn = document.querySelectorAll('.dayswitch__btn')[selectedDayIdx];
      return btn && btn.getAttribute('aria-pressed') === 'true';
    });
    ok(chipAktiv, 'Nach dem Wischen steht der passende Chip auf aria-pressed=true (Inhalt folgt)');

    // Über den Wochenrand: von Sonntag nach links -> Montag der Folgewoche
    await p.evaluate(() => { selectedDayIdx = 6; renderAll(); });
    const vorSonntag = await zustand(p);
    r = await geste(-120, 0);
    console.log('(b) Sonntag → links:       ', JSON.stringify(r), '→ Montag der Folgewoche, EIN Wisch');
    ok(r.idx === 0 && r.woche !== vorSonntag.woche, '(b) Wisch über Sonntag hinaus: anchor Folgewoche, idx 0, ein Wisch');
    ok(r.label !== vorSonntag.label, '(b) Topbar-Label wechselt mit');

    // Rückwärts über den Wochenrand: von Montag nach rechts -> Sonntag der Vorwoche
    await p.evaluate(() => { selectedDayIdx = 0; renderAll(); });
    const vorMontag = await zustand(p);
    r = await geste(120, 0);
    console.log('(c) Montag → rechts:       ', JSON.stringify(r), '→ Sonntag der Vorwoche, EIN Wisch');
    ok(r.idx === 6 && r.woche !== vorMontag.woche, '(c) rueckwaerts ueber den Wochenrand: anchor Vorwoche, idx 6, ein Wisch');

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
      const btn = document.querySelectorAll('.dayswitch__btn')[z];
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, ziel);

    // Fuenf Pixel Wackeln (unter TAP_SLOP=10 und unter der 10px-Achsen-
    // schwelle von streifenwischenEinrichten) -- muss als Tipp durchgehen,
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

  // ---- e: Pfeile funktionieren weiter --------------------------------
  {
    const { ctx, p, errs } = await neueSeite(b);
    const vor = await zustand(p);
    await p.locator('.dayswitch__nav--next').click();
    await p.waitForTimeout(150);
    const nachNext = await zustand(p);
    ok(nachNext.woche !== vor.woche, '(e) Pfeil "Woche vor" funktioniert weiterhin');

    await p.locator('.dayswitch__nav--prev').click();
    await p.waitForTimeout(150);
    const nachPrev = await zustand(p);
    ok(nachPrev.woche === vor.woche, '(e) Pfeil "Woche zurück" funktioniert weiterhin');

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
      const navs = [...document.querySelectorAll('.dayswitch__nav')].map(n => Math.round(n.getBoundingClientRect().width));
      const chips = [...document.querySelectorAll('.dayswitch__btn')].map(c => Math.round(c.getBoundingClientRect().width));
      const cs = getComputedStyle(document.querySelector('.dayswitch'));
      const sug = document.querySelector('.agenda__sugacts button');
      const blockSug = document.querySelector('.block__sug button');
      return {
        navs, chips, gap: cs.columnGap,
        sug: sug ? Math.round(sug.getBoundingClientRect().width) : null,
        blockSug: blockSug ? Math.round(blockSug.getBoundingClientRect().width) : null,
      };
    });
    console.log('(g) Geometrie 393px:', JSON.stringify(geo));
    ok(geo.navs.every(w => w >= 32), '(g) Pfeile bei 393px sichtbar >=32px: ' + geo.navs);
    ok(parseFloat(geo.gap) > 2, '(g) Chip-Luecken bei 393px > 2px: ' + geo.gap);
    if (geo.sug != null) ok(geo.sug >= 40, '(g) Vorschlags-Checkknopf (Agenda) bei 393px sichtbar >=40px: ' + geo.sug);
    if (geo.blockSug != null) ok(geo.blockSug >= 40, '(g) Vorschlags-Checkknopf (Raster) bei 393px sichtbar >=40px: ' + geo.blockSug);

    console.log('Konsolenfehler:', errs.length ? errs : 'keine');
    fehler.push(...errs);
    await ctx.close();
  }

  // ---- h: Geometrie 320px (SE) unangetastet ---------------------------
  {
    const { ctx, p, errs } = await neueSeite(b, { width: 320, height: 568 });
    const geo = await p.evaluate(() => {
      const navs = [...document.querySelectorAll('.dayswitch__nav')].map(n => Math.round(n.getBoundingClientRect().width));
      const cs = getComputedStyle(document.querySelector('.dayswitch'));
      const sug = document.querySelector('.agenda__sugacts button');
      const blockSug = document.querySelector('.block__sug button');
      const hourh = getComputedStyle(document.querySelector('.grid')).getPropertyValue('--hourh').trim();
      return {
        navs, gap: cs.columnGap, hourh,
        sug: sug ? Math.round(sug.getBoundingClientRect().width) : null,
        blockSug: blockSug ? Math.round(blockSug.getBoundingClientRect().width) : null,
      };
    });
    console.log('(h) Geometrie 320px (SE, Zweitkontext):', JSON.stringify(geo));
    ok(geo.navs.every(w => w === 22), '(h) SE: Pfeile bleiben exakt 22px: ' + geo.navs);
    ok(parseFloat(geo.gap) === 2, '(h) SE: Chip-Luecken bleiben exakt 2px: ' + geo.gap);
    ok(geo.hourh === '56px', '(h) SE: --hourh bleibt exakt 56px: ' + geo.hourh);
    if (geo.sug != null) ok(geo.sug === 34, '(h) SE: Vorschlags-Checkknopf (Agenda) bleibt 34px: ' + geo.sug);
    if (geo.blockSug != null) ok(geo.blockSug === 34, '(h) SE: Vorschlags-Checkknopf (Raster) bleibt 34px: ' + geo.blockSug);

    console.log('Konsolenfehler:', errs.length ? errs : 'keine');
    fehler.push(...errs);
    await ctx.close();
  }

  // ---- i: prefers-reduced-motion -- Wechsel funktioniert ohne Transform ---
  {
    const { ctx, p, errs } = await neueSeite(b, { reducedMotion: true });
    const cdp = await ctx.newCDPSession(p);
    const geste = macheGeste(p, cdp);
    const vor = await zustand(p);
    const nach = await geste(-120, 0);
    console.log('(i) reduced-motion, Wisch: ', JSON.stringify(nach));
    ok(nach.idx === vor.idx + 1, '(i) Streifen-Wisch wechselt den Tag auch mit prefers-reduced-motion');

    console.log('Konsolenfehler:', errs.length ? errs : 'keine');
    fehler.push(...errs);
    await ctx.close();
  }

  await b.close();

  // ---- Rot-Beweis fuer a/b/d ------------------------------------------
  // Sicherungskopie-Verfahren (Hausvertrag): Kopie der geaenderten Datei,
  // Aenderung zurueckgenommen (streifenwischenEinrichten NICHT mehr
  // aufgerufen -- die Funktion existiert, wird aber nie eingerichtet, wie
  // vor W1), gemessen, zurueckgelegt. Kein git stash: das Verfahren gilt
  // auch fuer diesen Baum, obwohl er sauber ist.
  console.log('\n--- Rot-Beweis (a/b/d): #daySwitch ohne streifenwischenEinrichten ---');
  const original = fs.readFileSync(INDEX, 'utf8');
  const marker = '  streifenwischenEinrichten();';
  if (!original.includes(marker)) {
    console.log('   FEHLER  Rot-Beweis: Aufrufstelle nicht gefunden, Verfahren übersprungen');
    fehler.push('Rot-Beweis: Aufrufstelle nicht gefunden');
  } else {
    const roterStand = original.replace(marker, '');
    fs.writeFileSync(INDEX, roterStand, 'utf8');
    try {
      const br2 = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
      const { ctx, p } = await neueSeite(br2);
      const cdp = await ctx.newCDPSession(p);
      const geste = macheGeste(p, cdp);
      const vor = await zustand(p);
      const nach = await geste(-120, 0);
      const rot = nach.idx === vor.idx;   // ohne Einrichtung DARF sich nichts ändern
      console.log('   Ohne streifenwischenEinrichten() wechselt der Wisch NICHT:', rot, '(soll: true — das ist der Beweis, dass a/b/d echt an der neuen Funktion hängen)');
      if (!rot) { fehler.push('Rot-Beweis fehlgeschlagen: Wisch wechselt den Tag auch ohne streifenwischenEinrichten()'); }
      await ctx.close();
      await br2.close();
    } finally {
      fs.writeFileSync(INDEX, original, 'utf8');
      console.log('   index.html wiederhergestellt.');
    }
  }

  console.log('\n' + (fehler.length ? fehler.length + ' FEHLER:' : 'Alle Pruefungen bestanden.'));
  fehler.forEach(f => console.log(' - ' + f));
  process.exit(fehler.length ? 1 : 0);
})();
