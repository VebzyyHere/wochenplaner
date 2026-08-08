// Prueft, dass ein Primaerknopf unter echtem Zeiger lesbar bleibt: im
// :hover-Zustand muss der WCAG-Kontrast von Schrift auf Hintergrund 4.5:1
// halten, in Hell und Dunkel. Hintergrund: .btn--primary:hover und das
// generische .btn:hover im @media (hover: hover)-Block sind gleich
// spezifisch — stand die Primaer-Regel VOR dem Block, gewann die spaetere
// generische Regel und faerbte den Knopf beim Hovern fast weiss, waehrend
// die Schrift weiss blieb (in Dunkel entsprechend umgekehrt). kontrast.js
// sieht das nicht: es prueft Token-Paare, nicht, welche Regel die Kaskade
// tatsaechlich liefert. Keine feste Uhr noetig — hier haengt nichts an
// Datum oder Uhrzeit. Endet mit Exit-Code 1 bei Fehlern.
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const SCHWELLE = 4.5; // Knopfschrift liegt unter 18.66px fett -> 'normal'

function relLum([r, g, b]) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const [R, G, B] = [f(r), f(g), f(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function kontrast(rgb1, rgb2) {
  const L1 = relLum(rgb1), L2 = relLum(rgb2);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  let fehler = 0;

  for (const theme of ['light', 'dark']) {
    console.log(`\n=== Primaerknopf-Hover (${theme === 'light' ? 'HELL' : 'DUNKEL'}) ===`);
    // Bewusst der Standard-Desktop-Kontext (kein Touch): nur dort greift
    // @media (hover: hover) — auf Touch-Profilen ist der fragliche Block
    // gar nicht aktiv, und genau deshalb hat ihn keine der Geraeteproben
    // in audit.js/dev.js je gesehen.
    const ctx = await br.newContext({ colorScheme: theme });
    const p = await ctx.newPage();
    await p.goto(F);
    await p.waitForTimeout(200);

    // applyTheme() setzt data-theme aus prefers-color-scheme — ohne diese
    // Kontrolle pruefte der Dunkel-Durchlauf sonst unbemerkt zweimal Hell.
    const themaIst = await p.evaluate(() => document.documentElement.dataset.theme || 'light');
    if (themaIst !== theme) {
      console.log(`  FEHLER Thema nicht uebernommen: erwartet ${theme}, ist ${themaIst}`);
      fehler++; await ctx.close(); continue;
    }

    // Sonde statt App-Knopf: ein frisch angehaengter .btn.btn--primary
    // durchlaeuft exakt dieselbe Kaskade, haengt aber nicht davon ab,
    // welche Ansicht oder welches Blatt gerade offen ist. Offene Dialoge
    // vorher schliessen, damit kein Top-Layer den Zeiger abfaengt.
    await p.evaluate(() => {
      document.querySelectorAll('dialog[open]').forEach(d => d.close());
      const b = document.createElement('button');
      b.id = 'hoverSonde'; b.type = 'button';
      b.className = 'btn btn--primary'; b.textContent = 'Speichern';
      b.style.position = 'fixed'; b.style.left = '20px'; b.style.top = '20px'; b.style.zIndex = '9999';
      // .btn blendet den Hintergrund in .15s um — gemessen direkt nach dem
      // Hover stuende sonst noch die Grundfarbe da, und der Test waere auch
      // auf einem kaputten Stand gruen. transition aus: der Endzustand der
      // Kaskade steht sofort fest, am Gewinner der Kaskade aendert das nichts.
      b.style.transition = 'none';
      document.body.appendChild(b);
    });

    for (const zustand of ['Ruhe', 'Hover']) {
      if (zustand === 'Hover') await p.hover('#hoverSonde');
      const [textRgb, hgRgb, textRoh, hgRoh] = await p.evaluate(() => {
        const el = document.getElementById('hoverSonde');
        const cs = getComputedStyle(el);
        // Dieselbe 1x1-Canvas wie in kontrast.js: erzwingt die Umrechnung
        // von oklch() in konkrete RGB-Bytes.
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        const g = c.getContext('2d');
        const zuRgb = (farbe) => {
          g.clearRect(0, 0, 1, 1);
          g.fillStyle = farbe;
          g.fillRect(0, 0, 1, 1);
          return Array.from(g.getImageData(0, 0, 1, 1).data).slice(0, 3);
        };
        return [zuRgb(cs.color), zuRgb(cs.backgroundColor), cs.color, cs.backgroundColor];
      });
      const q = kontrast(textRgb, hgRgb);
      const ok = q >= SCHWELLE;
      if (!ok) fehler++;
      console.log(`  ${ok ? 'OK   ' : 'FEHLER'} ${zustand}: ${q.toFixed(2)}:1` +
        (ok ? '' : ` (< ${SCHWELLE}:1)`) + ` — ${textRoh} auf ${hgRoh}`);

      // Screenshots werden angesehen, nicht nur gemessen (Vertrag in
      // CLAUDE.md) — der Hover-Zustand bleibt waehrend der Aufnahme aktiv.
      if (zustand === 'Hover') {
        await p.locator('#hoverSonde').screenshot({
          path: path.join(__dirname, `hover-${theme === 'light' ? 'hell' : 'dunkel'}.png`)
        });
      }
    }

    await ctx.close();
  }

  await br.close();
  console.log(`\n=== Ergebnis: ${fehler} Fehler ===`);
  process.exit(fehler ? 1 : 0);
})();
