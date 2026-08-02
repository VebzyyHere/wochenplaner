// Prueft die Design-Tokens im <style>-Block: fehlende Token (var(--x, Fallback)),
// Hex-Werte ausserhalb von :root, und WCAG-Kontrast der wichtigsten
// Text-auf-Hintergrund-Paare in Hell und Dunkel. Endet mit Exit-Code 1 bei Fehlern.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');
const QUELLE = path.resolve(__dirname, '..', 'index.html');

// ---- 1) Quelltext laden, <style>-Block herausschneiden ----------------
const quelltext = fs.readFileSync(QUELLE, 'utf8');
const styleMatch = quelltext.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) { console.error('Kein <style>-Block gefunden.'); process.exit(1); }
const style = styleMatch[1];
const styleStart = styleMatch.index + styleMatch[0].indexOf(style);
const zeileVon = (offset) => quelltext.slice(0, styleStart + offset).split('\n').length;

// ---- 2) var(--x, Fallback)-Konstruktionen melden -----------------------
console.log('=== var(--x, Fallback)-Konstruktionen ===');
const fallbackRe = /var\(\s*--[\w-]+\s*,[^)]*\)/g;
let m, fallbackTreffer = 0;
while ((m = fallbackRe.exec(style))) {
  fallbackTreffer++;
  console.log(`  Zeile ${zeileVon(m.index)}: ${m[0]}`);
}
if (!fallbackTreffer) console.log('  keine');

// ---- 3) Hex-Farbwerte ausserhalb des :root-Blocks melden ---------------
// :root- und dark-Theme-Block per Klammerzaehlung ausklammern, damit dort
// erlaubte Hex-Werte (falls je welche noetig werden) nicht mitgemeldet werden.
function blockRange(quelle, selectorRe) {
  const s = quelle.match(selectorRe);
  if (!s) return null;
  const openIdx = quelle.indexOf('{', s.index);
  let tiefe = 0, i = openIdx;
  for (; i < quelle.length; i++) {
    if (quelle[i] === '{') tiefe++;
    else if (quelle[i] === '}') { tiefe--; if (tiefe === 0) break; }
  }
  return [s.index, i];
}
const rootRange = blockRange(style, /:root\s*\{/);
const darkRange = blockRange(style, /html\[data-theme="dark"\]\s*\{/);
function inRange(idx, range) { return range && idx >= range[0] && idx <= range[1]; }

console.log('\n=== Hex-Farbwerte ausserhalb :root ===');
const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
let hexTreffer = 0;
while ((m = hexRe.exec(style))) {
  if (inRange(m.index, rootRange) || inRange(m.index, darkRange)) continue;
  hexTreffer++;
  console.log(`  Zeile ${zeileVon(m.index)}: ${m[0]}`);
}
if (!hexTreffer) console.log('  keine');

// ---- 4) WCAG-Kontrast der wichtigsten Text/Hintergrund-Paare -----------
// Groesse je Paar: 'normal' -> 4.5:1, 'gross' -> 3:1 (ab 18.66px fett bzw.
// 24px normal). Text-Groessen in dieser Oberflaeche liegen fast durchweg
// unter 14px/600 — 'gross' ist hier bislang nirgends belegt, die Schwelle
// bleibt aber nutzbar, falls doch einmal ein groesseres Paar dazukommt.
const PAARE = [
  ['--text',       '--bg',        'normal'],
  ['--text',       '--surface',   'normal'],
  ['--text',       '--surface-2', 'normal'],
  ['--text',       '--surface-3', 'normal'],
  ['--text-muted', '--bg',        'normal'],
  ['--text-muted', '--surface',   'normal'],
  ['--text-muted', '--surface-2', 'normal'],
  ['--text-faint', '--bg',        'normal'],
  ['--text-faint', '--surface',   'normal'],
  ['--text-faint', '--surface-2', 'normal'],
  ['--on-ink',     '--ink',       'normal'],
  ['--on-danger',  '--danger',    'normal'],
];
const SCHWELLE = { normal: 4.5, gross: 3.0 };

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
    console.log(`\n=== Kontrast (${theme === 'light' ? 'HELL' : 'DUNKEL'}) ===`);
    const ctx = await br.newContext({ colorScheme: theme });
    const p = await ctx.newPage();
    await p.goto(F);
    await p.waitForTimeout(200);

    const werte = await p.evaluate((paare) => {
      // Ueber eine 1x1-Canvas erzwingen wir die Umrechnung von oklch()
      // (oder was immer die Deklaration ist) in konkrete RGB-Bytes.
      const c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      const g = c.getContext('2d');
      const zuRgb = (farbe) => {
        g.clearRect(0, 0, 1, 1);
        g.fillStyle = farbe;
        g.fillRect(0, 0, 1, 1);
        return Array.from(g.getImageData(0, 0, 1, 1).data).slice(0, 3);
      };
      const cs = getComputedStyle(document.documentElement);
      const raw = {};
      const out = [];
      for (const [t, b, groesse] of paare) {
        if (!(t in raw)) raw[t] = cs.getPropertyValue(t).trim();
        if (!(b in raw)) raw[b] = cs.getPropertyValue(b).trim();
        out.push([t, b, groesse, zuRgb(raw[t]), zuRgb(raw[b]), raw[t], raw[b]]);
      }
      return out;
    }, PAARE);

    for (const [tName, bName, groesse, tRgb, bRgb, tRaw, bRaw] of werte) {
      const q = kontrast(tRgb, bRgb);
      const schwelle = SCHWELLE[groesse];
      const ok = q >= schwelle;
      if (!ok) fehler++;
      console.log(`  ${ok ? 'OK   ' : 'FEHLER'} ${tName} auf ${bName} (${groesse}): ${q.toFixed(2)}:1` +
        (ok ? '' : ` (< ${schwelle}:1) — ${tRaw} auf ${bRaw}`));
    }

    await ctx.close();
  }

  await br.close();
  console.log(`\n=== Ergebnis: ${fehler} Fehler ===`);
  process.exit(fehler ? 1 : 0);
})();
